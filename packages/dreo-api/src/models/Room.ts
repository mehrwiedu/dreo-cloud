import type { Device } from "./Device.js";

/**
 * Represents a room inside a Dreo family/home.
 */
export interface Room {
    id: string;
    roomName: string;
    roomNameI18Key: string;

    type: number;
    sort: number;

    devices: Device[];
}
