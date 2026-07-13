import WebSocket from "ws";

import type { DreoSession } from "../DreoSession.js";
import type { DreoLogger } from "../DreoLogger.js";
import type {
    DreoSessionChangeReason,
    DreoSessionObserver,
} from "../DreoSessionObserver.js";
import { DreoWebSocketError } from "../errors.js";
import type { DreoWebSocketMessage } from "./DreoWebSocketMessage.js";
import type { DreoWebSocketReply } from "./DreoWebSocketReply.js";

const DREO_WEBSOCKET_PING_INTERVAL_MS = 15_000;
const DREO_WEBSOCKET_PING_MESSAGE = "2";
const DREO_WEBSOCKET_RECONNECT_DELAY_MS = 5_000;

export interface DreoWebSocketClientOptions {
    session: DreoSession;
    logger?: DreoLogger;
}

export type DreoWebSocketReportHandler = (reply: DreoWebSocketReply) => void;

export type DreoWebSocketUnsubscribe = () => void;

export class DreoWebSocketClient implements DreoSessionObserver {
    private socket?: WebSocket;

    private connectPromise?: Promise<void>;

    private reconnectPromise?: Promise<void>;

    private pingInterval?: NodeJS.Timeout;

    private shouldStayConnected = false;

    private pendingReply?: {
        resolve: (reply: DreoWebSocketReply) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    };

    private readonly reportHandlers = new Set<DreoWebSocketReportHandler>();

    public constructor(private readonly options: DreoWebSocketClientOptions) {}

    public async connect(): Promise<void> {
        this.shouldStayConnected = true;

        if (this.socket?.readyState === WebSocket.OPEN) {
            return;
        }

        if (this.connectPromise) {
            return this.connectPromise;
        }

        this.connectPromise = this.connectInternal();

        try {
            await this.connectPromise;
        } finally {
            this.connectPromise = undefined;
        }
    }

    public onReport(
        handler: DreoWebSocketReportHandler
    ): DreoWebSocketUnsubscribe {
        this.reportHandlers.add(handler);

        return () => {
            this.reportHandlers.delete(handler);
        };
    }

    public async onSessionChanged(
        _snapshot: unknown,
        reason: DreoSessionChangeReason
    ): Promise<void> {
        if (!this.shouldStayConnected) {
            return;
        }

        if (reason === "initial-login") {
            return;
        }

        await this.reconnect(reason);
    }

    public onSessionInvalidated(): void {
        this.disconnect();
    }

    public async sendCommand(
        deviceSn: string,
        key: string,
        value: unknown
    ): Promise<DreoWebSocketReply> {
        return this.sendCommandParams(deviceSn, {
            [key]: value,
        });
    }

    public async sendCommandParams(
        deviceSn: string,
        params: Record<string, unknown>
    ): Promise<DreoWebSocketReply> {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            throw new DreoWebSocketError("WebSocket is not connected.");
        }

        const payload: DreoWebSocketMessage = {
            devicesn: deviceSn,
            method: "control",
            params,
            timestamp: Date.now(),
        };

        this.logDebug("Sending WebSocket command.", payload);

        const replyPromise = new Promise<DreoWebSocketReply>(
            (resolve, reject) => {
                const timeout = setTimeout(() => {
                    if (this.pendingReply) {
                        this.pendingReply = undefined;

                        reject(
                            new DreoWebSocketError(
                                "Timed out waiting for WebSocket reply."
                            )
                        );
                    }
                }, 10_000);

                this.pendingReply = {
                    resolve,
                    reject,
                    timeout,
                };
            }
        );

        await new Promise<void>((resolve, reject) => {
            this.socket!.send(JSON.stringify(payload), (error) => {
                if (error) {
                    reject(
                        new DreoWebSocketError(
                            `Failed to send WebSocket command: ${error.message}`
                        )
                    );

                    return;
                }

                resolve();
            });
        });

        return replyPromise;
    }

    public disconnect(): void {
        this.shouldStayConnected = false;
        this.stopPingInterval();
        this.rejectPendingReply(
            new DreoWebSocketError("WebSocket disconnected.")
        );

        const socket = this.socket;
        this.socket = undefined;

        if (!socket) {
            return;
        }

        if (
            socket.readyState === WebSocket.CONNECTING ||
            socket.readyState === WebSocket.OPEN
        ) {
            socket.close();
        }
    }

    private async connectInternal(): Promise<void> {
        const tokens = this.options.session.getCurrentTokens();

        if (!tokens) {
            throw new DreoWebSocketError(
                "Cannot connect WebSocket without an active Dreo session."
            );
        }

        const timestamp = Date.now();

        const url =
            `wss://wsb-${tokens.region}.dreo-tech.com/websocket` +
            `?accessToken=${encodeURIComponent(tokens.accessToken)}` +
            `&timestamp=${timestamp}`;

        const socket = new WebSocket(url);
        this.socket = socket;

        return new Promise((resolve, reject) => {
            let settled = false;

            const resolveOnce = (): void => {
                if (settled) {
                    return;
                }

                settled = true;
                resolve();
            };

            const rejectOnce = (error: Error): void => {
                if (settled) {
                    return;
                }

                settled = true;
                reject(error);
            };

            socket.once("open", () => {
                if (!this.shouldStayConnected) {
                    socket.close();

                    rejectOnce(
                        new DreoWebSocketError(
                            "WebSocket connection was cancelled."
                        )
                    );

                    return;
                }

                this.logInfo("WebSocket connected.");
                this.startPingInterval(socket);
                resolveOnce();
            });

            socket.once("error", (error) => {
                rejectOnce(
                    new DreoWebSocketError(
                        `WebSocket connection failed: ${error.message}`
                    )
                );
            });

            socket.on("message", (message) => {
                this.handleMessage(message.toString());
            });

            socket.once("close", () => {
                this.logInfo("WebSocket closed.");

                const wasCurrentSocket = this.socket === socket;

                if (wasCurrentSocket) {
                    this.socket = undefined;
                    this.stopPingInterval();
                }

                this.rejectPendingReply(
                    new DreoWebSocketError("WebSocket closed.")
                );

                if (!settled) {
                    rejectOnce(
                        new DreoWebSocketError(
                            "WebSocket closed before connection was established."
                        )
                    );

                    return;
                }

                if (wasCurrentSocket && this.shouldStayConnected) {
                    void this.reconnect("websocket-closed");
                }
            });
        });
    }

    private async reconnect(reason: string): Promise<void> {
        if (this.reconnectPromise) {
            return this.reconnectPromise;
        }

        this.reconnectPromise = this.reconnectInternal(reason);

        try {
            await this.reconnectPromise;
        } finally {
            this.reconnectPromise = undefined;
        }
    }

    private async reconnectInternal(reason: string): Promise<void> {
        this.logInfo(`Reconnecting WebSocket because: ${reason}`);

        this.rejectPendingReply(
            new DreoWebSocketError(`WebSocket reconnecting because: ${reason}`)
        );

        this.stopPingInterval();

        const socket = this.socket;
        this.socket = undefined;

        if (
            socket &&
            (socket.readyState === WebSocket.CONNECTING ||
                socket.readyState === WebSocket.OPEN)
        ) {
            socket.close();
        }

        await this.wait(DREO_WEBSOCKET_RECONNECT_DELAY_MS);

        if (!this.shouldStayConnected) {
            return;
        }

        await this.connect();
    }

    private startPingInterval(socket: WebSocket): void {
        this.stopPingInterval();

        this.pingInterval = setInterval(() => {
            if (this.socket !== socket) {
                return;
            }

            if (socket.readyState !== WebSocket.OPEN) {
                return;
            }

            socket.send(DREO_WEBSOCKET_PING_MESSAGE, (error) => {
                if (!error) {
                    this.logDebug("DREO WebSocket keepalive sent.");
                    return;
                }

                this.logWarn(
                    `Failed to send DREO WebSocket keepalive: ${error.message}`
                );

                if (this.socket === socket) {
                    socket.close();
                }
            });
        }, DREO_WEBSOCKET_PING_INTERVAL_MS);
    }

    private stopPingInterval(): void {
        if (!this.pingInterval) {
            return;
        }

        clearInterval(this.pingInterval);
        this.pingInterval = undefined;
    }

    private rejectPendingReply(error: Error): void {
        if (!this.pendingReply) {
            return;
        }

        const pending = this.pendingReply;

        clearTimeout(pending.timeout);

        this.pendingReply = undefined;
        pending.reject(error);
    }

    private handleMessage(text: string): void {
        this.logDebug("WebSocket message received.", text);

        try {
            const message = JSON.parse(text) as DreoWebSocketReply;

            if (message.method === "control-reply" && this.pendingReply) {
                const pending = this.pendingReply;

                clearTimeout(pending.timeout);

                this.pendingReply = undefined;
                pending.resolve(message);

                return;
            }

            if (
                message.method === "control-report" ||
                message.method === "report" ||
                message.method === "device-online"
            ) {
                for (const handler of Array.from(this.reportHandlers)) {
                    handler(message);
                }
            }
        } catch {
            // Non-JSON messages are expected.
        }
    }

    private async wait(milliseconds: number): Promise<void> {
        await new Promise<void>((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    }

    private logDebug(message: string, data?: unknown): void {
        this.options.logger?.debug?.(message, data);
    }

    private logInfo(message: string, data?: unknown): void {
        this.options.logger?.info?.(message, data);
    }

    private logWarn(message: string, data?: unknown): void {
        this.options.logger?.warn?.(message, data);
    }
}
