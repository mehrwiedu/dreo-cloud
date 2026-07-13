import type { DreoDeviceState } from "./models/DreoDeviceState.js";

export type StateChange = {
    power?: boolean;

    fan?: boolean;
    mainLight?: boolean;
    atmosphereLight?: boolean;

    windLevel?: number;
    brightness?: number;
    colorTemperature?: number;

    rgbPreset?: number;
    atmosphereBrightness?: number;
};

export class StateMapper {
    public build(
        current: DreoDeviceState,
        change: StateChange
    ): Record<string, unknown> {
        const payload: Record<string, unknown> = {};

        if (change.atmosphereLight !== undefined) {
            if (change.atmosphereLight) {
                payload.poweron = true;
                payload.atmon = true;
            } else {
                payload.atmon = false;
            }
        }

        if (change.mainLight !== undefined) {
            if (change.mainLight) {
                payload.poweron = true;
                payload.lighton = true;
            } else {
                payload.lighton = false;
            }
        }

        if (change.fan !== undefined) {
            if (change.fan) {
                payload.poweron = true;
                payload.fanon = true;
            } else {
                payload.fanon = false;
            }
        }

        if (change.windLevel !== undefined) {
            payload.windlevel = change.windLevel;

            if (change.windLevel > 0) {
                payload.poweron = true;
                payload.fanon = true;
            }
        }

        if (change.brightness !== undefined) {
            payload.brightness = change.brightness;
            payload.poweron = true;
            payload.lighton = true;
        }

        if (change.colorTemperature !== undefined) {
            payload.colortemp = change.colorTemperature;
            payload.poweron = true;
            payload.lighton = true;
        }

        if (change.rgbPreset !== undefined) {
            payload.rgbpresetsel = change.rgbPreset;

            if (change.rgbPreset > 0) {
                payload.poweron = true;
                payload.atmon = true;
            }
        }

        if (change.atmosphereBrightness !== undefined) {
            payload.atmbri = change.atmosphereBrightness;
            payload.poweron = true;
            payload.atmon = true;
        }

        const switchedOffPowerScopedState =
            change.fan === false ||
            change.mainLight === false ||
            change.atmosphereLight === false;

        if (
            switchedOffPowerScopedState &&
            !this.hasEnabledPowerScopedState(current, payload)
        ) {
            payload.poweron = false;
        }

        if (change.power !== undefined) {
            payload.poweron = change.power;
        }

        return payload;
    }

    private hasEnabledPowerScopedState(
        current: DreoDeviceState,
        payload: Record<string, unknown>
    ): boolean {
        return (
            this.readNextBoolean(current, payload, "fanon") ||
            this.readNextBoolean(current, payload, "lighton") ||
            this.readNextBoolean(current, payload, "atmon")
        );
    }

    private readNextBoolean(
        current: DreoDeviceState,
        payload: Record<string, unknown>,
        key: string
    ): boolean {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            return Boolean(payload[key]);
        }

        return Boolean(current.raw[key]);
    }
}
