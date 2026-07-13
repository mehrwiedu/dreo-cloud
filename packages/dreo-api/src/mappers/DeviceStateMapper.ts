import type { DeviceState } from "../models/DeviceState.js";
import type {
    DeviceMixedState,
    DeviceStateResponse,
} from "../models/DeviceStateResponse.js";

export class DeviceStateMapper {
    public map(response: DeviceStateResponse): DeviceState {
        const mixed = response.data.mixed;

        return {
            connected: this.readBoolean(mixed, "connected", false),

            power: this.readBoolean(mixed, "poweron", false),

            mode: this.readNumber(mixed, "mode", 0),

            windLevel: this.readNumber(mixed, "windlevel", 0),

            mute: this.readBoolean(mixed, "muteon", false),

            childLock: this.readOptionalBoolean(mixed, "childlockon"),

            light: this.readOptionalBoolean(mixed, "lighton"),
        };
    }

    private readBoolean(
        mixed: DeviceMixedState,
        key: string,
        fallback: boolean
    ): boolean {
        const value = mixed[key]?.state;

        return typeof value === "boolean" ? value : fallback;
    }

    private readOptionalBoolean(
        mixed: DeviceMixedState,
        key: string
    ): boolean | undefined {
        const value = mixed[key]?.state;

        return typeof value === "boolean" ? value : undefined;
    }

    private readNumber(
        mixed: DeviceMixedState,
        key: string,
        fallback: number
    ): number {
        const value = mixed[key]?.state;

        return typeof value === "number" ? value : fallback;
    }
}
