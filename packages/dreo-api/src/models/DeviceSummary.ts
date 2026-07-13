export interface DeviceSummary {
    deviceId: string;

    sn: string;

    deviceName: string;

    resourcesConf?: {
        imageSmallSrc?: string | null;
        imageFullSrc?: string | null;

        imageSmallDarkSrc?: string | null;
        imageFullDarkSrc?: string | null;
    };
}
