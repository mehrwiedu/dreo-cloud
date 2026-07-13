import type { Device } from "./Device.js";

export interface DeviceListResponse {
    code: number;

    message?: string;

    data?: {
        list?: Device[];
    };
}
