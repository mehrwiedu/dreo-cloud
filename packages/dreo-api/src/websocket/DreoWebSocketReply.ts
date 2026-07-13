export interface DreoWebSocketReply {
    method: string;
    devicesn: string;
    messageid?: string;
    timestamp?: number;
    reported?: Record<string, unknown>;
}
