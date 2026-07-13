import type { Device } from "../models/Device.js";
import type { Family } from "../models/Family.js";
import type { FamilyTree } from "../models/FamilyTree.js";
import type { Room } from "../models/Room.js";
import type { FamilyRoomDevicesResponse } from "../models/FamilyRoomDevicesResponse.js";

type DeviceApiProfile = Device & {
    controlsConf?: unknown;
    control?: unknown;
    schedule?: unknown;
    mainConf?: unknown;
    servicesConf?: unknown;
};

export class FamilyTreeMapper {
    public map(response: FamilyRoomDevicesResponse): FamilyTree {
        const devices = this.mapDevices(response);
        const families = this.mapFamilies(response, devices);

        return {
            families,
            devices,
        };
    }

    private mapDevices(response: FamilyRoomDevicesResponse): Device[] {
        return response.data.list.map((device) => {
            const apiDevice = device as DeviceApiProfile;

            return {
                deviceId: apiDevice.deviceId,
                sn: apiDevice.sn,
                deviceName: apiDevice.deviceName,
                brand: apiDevice.brand,
                model: apiDevice.model,
                productId: apiDevice.productId,
                productName: apiDevice.productName,
                owner: apiDevice.owner,
                shared: apiDevice.shared,
                resourcesConf: apiDevice.resourcesConf,
                capabilities: {
                    controlsConf: apiDevice.controlsConf,
                    control: apiDevice.control,
                    schedule: apiDevice.schedule,
                    mainConf: apiDevice.mainConf,
                    servicesConf: apiDevice.servicesConf,
                },
            };
        });
    }

    private mapFamilies(
        response: FamilyRoomDevicesResponse,
        devices: Device[]
    ): Family[] {
        return response.data.familyRooms.map((family) => ({
            ...family,
            rooms: this.mapRooms(family.rooms, devices),
        }));
    }

    private mapRooms(rooms: Room[], devices: Device[]): Room[] {
        return rooms.map((room) => ({
            ...room,
            devices: room.devices.map((roomDevice) => {
                const fullDevice = devices.find(
                    (device) => device.deviceId === roomDevice.deviceId
                );

                return fullDevice ?? roomDevice;
            }),
        }));
    }
}
