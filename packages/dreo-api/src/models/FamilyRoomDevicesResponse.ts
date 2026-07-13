import type { Family } from "./Family.js";
import type { Device } from "./Device.js";

export interface FamilyRoomDevicesResponse {
    code: number;
    msg: string;
    data: {
        familyRooms: Family[];
        list: Device[];
    };
}
