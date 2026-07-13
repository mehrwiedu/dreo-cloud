/**
 * WebSocket payload sent to the Dreo cloud.
 */
export interface DreoWebSocketMessage {
    devicesn: string;

    method: "control";

    params: Record<string, unknown>;

    timestamp: number;
}
