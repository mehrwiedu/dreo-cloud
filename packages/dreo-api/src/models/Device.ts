import type { DeviceCapabilities } from "./DeviceCapabilities.js";

export interface Device {
    deviceId: string;

    sn: string;

    deviceName: string;

    brand: string;

    model: string;

    productId: string;

    productName: string;

    owner: boolean;

    shared: boolean;

    resourcesConf?: {
        imageSmallSrc?: string | null;
        imageFullSrc?: string | null;

        imageSmallDarkSrc?: string | null;
        imageFullDarkSrc?: string | null;
    };

    capabilities?: DeviceCapabilities;
}
