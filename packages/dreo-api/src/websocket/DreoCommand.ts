/**
 * Represents a command sent to a Dreo device via WebSocket.
 */
export interface DreoCommand {
    /**
     * Command key, e.g. "lighton".
     */
    key: string;

    /**
     * Command value.
     */
    value: unknown;
}
