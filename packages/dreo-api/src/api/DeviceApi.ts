import { AuthenticatedHttpClient } from "./AuthenticatedHttpClient.js";

import type { DeviceListResponse } from "../models/DeviceListResponse.js";
import type { DeviceStateResponse } from "../models/DeviceStateResponse.js";

export class DeviceApi {
    public constructor(private readonly http: AuthenticatedHttpClient) {}

    public async list(): Promise<DeviceListResponse> {
        return this.http.get<DeviceListResponse>(
            "/api/v2/user-device/device/list",
            {
                query: {
                    acceptLanguage: "en",
                    method: "devices",
                    pageNo: "1",
                    pageSize: "100",
                },
            }
        );
    }

    public async state(sn: string): Promise<DeviceStateResponse> {
        return this.http.get<DeviceStateResponse>(
            "/api/user-device/device/state",
            {
                query: {
                    deviceSn: sn,
                },
            }
        );
    }
}
