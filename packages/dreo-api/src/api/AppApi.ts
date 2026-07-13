import { AuthenticatedHttpClient } from "./AuthenticatedHttpClient.js";
import type { FamilyRoomDevicesResponse } from "../models/FamilyRoomDevicesResponse.js";

export class AppApi {
    public constructor(private readonly httpClient: AuthenticatedHttpClient) {}

    public async getFamilyRoomDevices(): Promise<FamilyRoomDevicesResponse> {
        return this.httpClient.post<FamilyRoomDevicesResponse>(
            "/api/app/index/family/room/devices",
            []
        );
    }
}
