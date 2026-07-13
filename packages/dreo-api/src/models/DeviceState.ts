/**
 * Represents the current runtime state of a Dreo device.
 */
export interface DeviceState {
    connected: boolean;

    power: boolean;

    mode: number;

    windLevel: number;

    mute: boolean;

    childLock?: boolean;

    light?: boolean;
}
