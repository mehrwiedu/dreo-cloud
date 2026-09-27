export interface DreoWebSocketReply {
    method: string;
    devicesn: string;
    messageid?: string;
    timestamp?: number;
    reported?: Record<string, unknown>;

    /**
     * DREO cloud error code returned by failed control commands.
     *
     * The WebSocket payload is untrusted, so the value remains unknown until
     * it is normalized by DreoWebSocketClient.
     */
    error_code?: unknown;

    /**
     * DREO cloud error message returned by failed control commands.
     */
    error_msg?: unknown;
}
