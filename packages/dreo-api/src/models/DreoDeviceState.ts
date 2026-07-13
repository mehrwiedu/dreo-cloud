export interface DreoDeviceState {
    power?: boolean;

    fan?: boolean;
    mainLight?: boolean;
    atmosphereLight?: boolean;
    mute?: boolean;

    windLevel?: number;
    mode?: number;

    brightness?: number;
    colorTemperature?: number;

    rgbPreset?: number;
    rgbEffectId?: string;

    rssi?: unknown;

    raw: Record<string, unknown>;
}
