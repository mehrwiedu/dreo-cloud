export interface DeviceStateValue<TValue = unknown> {
    state: TValue;
    timestamp: number | null;
}

export interface DeviceTimerValue {
    du: number;
    ts: number;
}

export type DeviceMixedState = Record<string, DeviceStateValue>;

export interface DeviceStateResponse {
    code: number;
    msg: string;
    data: {
        mixed: DeviceMixedState;
        sn: string;
        productId: string;
        region: string;
        deviceInfo: unknown | null;
    };
}
