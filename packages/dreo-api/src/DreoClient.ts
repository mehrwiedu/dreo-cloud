import { AppApi } from "./api/AppApi.js";
import { AuthenticatedHttpClient } from "./api/AuthenticatedHttpClient.js";
import { DeviceApi } from "./api/DeviceApi.js";
import { HttpClient } from "./api/HttpClient.js";
import { DreoSession } from "./DreoSession.js";
import { DreoDevice } from "./DreoDevice.js";
import type { DreoLogger } from "./DreoLogger.js";
import { FamilyTreeMapper } from "./mappers/FamilyTreeMapper.js";
import type { FamilyTree } from "./models/FamilyTree.js";
import type { ResolvedDevice } from "./models/ResolvedDevice.js";
import type { StateConstraint } from "./models/StateConstraint.js";
import { ResolvedDeviceResolver } from "./ResolvedDeviceResolver.js";
import {
    DreoWebSocketClient,
    type DreoWebSocketUnsubscribe,
} from "./websocket/DreoWebSocketClient.js";
import type { DreoWebSocketReply } from "./websocket/DreoWebSocketReply.js";

export interface DreoClientLoginOptions {
    email: string;
    password: string;
    region?: string;
    logger?: DreoLogger;
}

export interface DreoDeviceStateChangeEvent {
    device: DreoDevice;
    report: DreoWebSocketReply;
    reported: Record<string, unknown>;
}

export type DreoDeviceStateChangeHandler = (
    event: DreoDeviceStateChangeEvent
) => void;

export type DreoDeviceStateChangeUnsubscribe = () => void;

export interface DreoDeviceDiscoveredEvent {
    device: DreoDevice;
    resolvedDevice: ResolvedDevice;
}

export type DreoDeviceDiscoveredHandler = (
    event: DreoDeviceDiscoveredEvent
) => void;

export type DreoDeviceDiscoveredUnsubscribe = () => void;

export class DreoClient {
    private readonly devices = new Map<string, DreoDevice>();

    private readonly resolvedDevices = new Map<string, ResolvedDevice>();

    private readonly resolvedDeviceResolver = new ResolvedDeviceResolver();

    private session?: DreoSession;

    private websocket?: DreoWebSocketClient;

    private unsubscribeWebSocketReport?: DreoWebSocketUnsubscribe;

    private readonly deviceStateChangeHandlers =
        new Set<DreoDeviceStateChangeHandler>();

    private readonly deviceDiscoveredHandlers =
        new Set<DreoDeviceDiscoveredHandler>();

    private deviceSyncPromise?: Promise<void>;

    public constructor(
        private readonly appApi: AppApi,
        private readonly deviceApi: DeviceApi,
        private readonly logger?: DreoLogger
    ) {}

    public static async login(
        options: DreoClientLoginOptions
    ): Promise<DreoClient> {
        const session = new DreoSession({
            email: options.email,
            password: options.password,
            region: options.region ?? "EU",
            logger: options.logger,
        });

        const tokens = await session.login();

        const http = new HttpClient({
            baseUrl: `https://app-api-${tokens.region}.dreo-tech.com`,
        });

        const authenticatedHttp = new AuthenticatedHttpClient(
            http,
            session,
            options.logger
        );

        const appApi = new AppApi(authenticatedHttp);
        const deviceApi = new DeviceApi(authenticatedHttp);

        const websocket = new DreoWebSocketClient({
            session,
            logger: options.logger,
        });

        session.addObserver(websocket);

        const client = new DreoClient(
            appApi,
            deviceApi,
            options.logger
        );

        client.session = session;
        client.websocket = websocket;

        await client.sync(websocket);
        await websocket.connect();

        return client;
    }

    public async getFamilyTree(): Promise<FamilyTree> {
        const response = await this.appApi.getFamilyRoomDevices();

        return new FamilyTreeMapper().map(response);
    }

    public async sync(websocket: DreoWebSocketClient): Promise<void> {
        const tree = await this.getFamilyTree();

        this.devices.clear();
        this.resolvedDevices.clear();

        for (const device of tree.devices) {
            const state = await this.deviceApi.state(device.sn);

            const resolvedDevice = this.resolvedDeviceResolver.resolve(
                device,
                state
            );

            this.resolvedDevices.set(device.sn, resolvedDevice);

            this.registerDevice(
                new DreoDevice(
                    device,
                    websocket,
                    this.createStateConstraintMap(resolvedDevice),
                    this.createInitialRawState(resolvedDevice)
                )
            );
        }

        this.unsubscribeWebSocketReport?.();

        this.unsubscribeWebSocketReport = websocket.onReport((report) => {
            void this.applyWebSocketReport(report).catch((error) => {
                this.logger?.warn?.(
                    `Failed to process DREO WebSocket report: ${
                        error instanceof Error
                            ? error.message
                            : String(error)
                    }`
                );
            });
        });
    }

    public async getResolvedDevices(): Promise<readonly ResolvedDevice[]> {
        const tree = await this.getFamilyTree();

        this.resolvedDevices.clear();

        for (const device of tree.devices) {
            const state = await this.deviceApi.state(device.sn);

            const resolvedDevice = this.resolvedDeviceResolver.resolve(
                device,
                state
            );

            this.resolvedDevices.set(device.sn, resolvedDevice);
        }

        return Array.from(this.resolvedDevices.values());
    }

    public getResolvedDevice(serialNumber: string): ResolvedDevice | undefined {
        return this.resolvedDevices.get(serialNumber);
    }

    public getResolvedDeviceByName(name: string): ResolvedDevice | undefined {
        return Array.from(this.resolvedDevices.values()).find(
            (resolvedDevice) => resolvedDevice.device.deviceName === name
        );
    }

    public async getDeviceState(serialNumber: string) {
        return this.deviceApi.state(serialNumber);
    }

    public onDeviceStateChanged(
        handler: DreoDeviceStateChangeHandler
    ): DreoDeviceStateChangeUnsubscribe {
        this.deviceStateChangeHandlers.add(handler);

        return () => {
            this.deviceStateChangeHandlers.delete(handler);
        };
    }

    public onDeviceDiscovered(
        handler: DreoDeviceDiscoveredHandler
    ): DreoDeviceDiscoveredUnsubscribe {
        this.deviceDiscoveredHandlers.add(handler);

        return () => {
            this.deviceDiscoveredHandlers.delete(handler);
        };
    }

    public disconnect(): void {
        this.unsubscribeWebSocketReport?.();
        this.unsubscribeWebSocketReport = undefined;
        this.deviceStateChangeHandlers.clear();
        this.deviceDiscoveredHandlers.clear();
        this.deviceSyncPromise = undefined;

        if (this.session && this.websocket) {
            this.session.removeObserver(this.websocket);
        }

        this.websocket?.disconnect();

        this.websocket = undefined;
        this.session = undefined;
    }

    public registerDevice(device: DreoDevice): void {
        this.devices.set(device.sn, device);
    }

    public getDevice(serialNumber: string): DreoDevice | undefined {
        return this.devices.get(serialNumber);
    }

    public getDeviceByName(name: string): DreoDevice | undefined {
        return this.getDevices().find((device) => device.name === name);
    }

    public getDevices(): readonly DreoDevice[] {
        return Array.from(this.devices.values());
    }

    private createInitialRawState(
        resolvedDevice: ResolvedDevice
    ): Record<string, unknown> {
        const initialRawState: Record<string, unknown> = {};

        for (const [key, mixedState] of Object.entries(
            resolvedDevice.state.data.mixed
        )) {
            initialRawState[key] = mixedState.state;
        }

        return initialRawState;
    }

    private createStateConstraintMap(
        resolvedDevice: ResolvedDevice
    ): ReadonlyMap<string, StateConstraint> {
        const constraints = new Map<string, StateConstraint>();

        for (const state of resolvedDevice.states) {
            if (state.constraint) {
                constraints.set(state.key, state.constraint);
            }
        }

        return constraints;
    }

    private async applyWebSocketReport(
        report: DreoWebSocketReply
    ): Promise<void> {
        if (!report.reported) {
            return;
        }

        await this.ensureDeviceRegistered(report.devicesn);

        const device = this.getDevice(report.devicesn);

        if (!device) {
            this.logger?.warn?.(
                `Received DREO WebSocket report for unknown device ${report.devicesn}.`
            );
            return;
        }

        device.applyReport(report.reported);

        this.emitDeviceStateChanged({
            device,
            report,
            reported: report.reported,
        });
    }

    private async ensureDeviceRegistered(
        serialNumber: string
    ): Promise<void> {
        if (this.getDevice(serialNumber)) {
            return;
        }

        if (!this.deviceSyncPromise) {
            this.deviceSyncPromise = this.syncNewDevices().finally(() => {
                this.deviceSyncPromise = undefined;
            });
        }

        await this.deviceSyncPromise;
    }

    private async syncNewDevices(): Promise<void> {
        const websocket = this.websocket;

        if (!websocket) {
            throw new Error(
                "Cannot synchronize DREO devices without a WebSocket client."
            );
        }

        const tree = await this.getFamilyTree();

        for (const deviceInfo of tree.devices) {
            if (this.getDevice(deviceInfo.sn)) {
                continue;
            }

            const state = await this.deviceApi.state(deviceInfo.sn);

            const resolvedDevice = this.resolvedDeviceResolver.resolve(
                deviceInfo,
                state
            );

            const device = new DreoDevice(
                deviceInfo,
                websocket,
                this.createStateConstraintMap(resolvedDevice),
                this.createInitialRawState(resolvedDevice)
            );

            this.resolvedDevices.set(deviceInfo.sn, resolvedDevice);
            this.registerDevice(device);

            this.logger?.info?.(
                `Discovered new DREO device: ${deviceInfo.deviceName} (${deviceInfo.model}, ${deviceInfo.sn})`
            );

            this.emitDeviceDiscovered({
                device,
                resolvedDevice,
            });
        }
    }

    private emitDeviceStateChanged(event: DreoDeviceStateChangeEvent): void {
        for (const handler of this.deviceStateChangeHandlers) {
            handler(event);
        }
    }

    private emitDeviceDiscovered(event: DreoDeviceDiscoveredEvent): void {
        for (const handler of this.deviceDiscoveredHandlers) {
            handler(event);
        }
    }
}
