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
        const supportsPowerOn = this.supportsRawState(current, "poweron");

        if (change.atmosphereLight !== undefined) {
            if (change.atmosphereLight) {
                if (supportsPowerOn) {
                    payload.poweron = true;
                }

                payload.atmon = true;
            } else {
                payload.atmon = false;
            }
        }

        if (change.mainLight !== undefined) {
            if (change.mainLight) {
                if (supportsPowerOn) {
                    payload.poweron = true;
                }

                payload.lighton = true;
            } else {
                payload.lighton = false;
            }
        }

        if (change.fan !== undefined) {
            if (change.fan) {
                if (supportsPowerOn) {
                    payload.poweron = true;
                }

                payload.fanon = true;
            } else {
                payload.fanon = false;
            }
        }

        if (change.windLevel !== undefined) {
            payload.windlevel = change.windLevel;

            if (change.windLevel > 0) {
                if (supportsPowerOn) {
                    payload.poweron = true;
                }

                payload.fanon = true;
            }
        }

        if (change.brightness !== undefined) {
            payload.brightness = change.brightness;

            if (supportsPowerOn) {
                payload.poweron = true;
            }

            payload.lighton = true;
        }

        if (change.colorTemperature !== undefined) {
            payload.colortemp = change.colorTemperature;

            if (supportsPowerOn) {
                payload.poweron = true;
            }

            payload.lighton = true;
        }

        if (change.rgbPreset !== undefined) {
            payload.rgbpresetsel = change.rgbPreset;

            if (change.rgbPreset > 0) {
                if (supportsPowerOn) {
                    payload.poweron = true;
                }

                payload.atmon = true;
            }
        }

        if (change.atmosphereBrightness !== undefined) {
            payload.atmbri = change.atmosphereBrightness;

            if (supportsPowerOn) {
                payload.poweron = true;
            }

            payload.atmon = true;
        }

        const switchedOffPowerScopedState =
            change.fan === false ||
            change.mainLight === false ||
            change.atmosphereLight === false;

        if (
            supportsPowerOn &&
            switchedOffPowerScopedState &&
            !this.hasEnabledPowerScopedState(current, payload)
        ) {
            payload.poweron = false;
        }

        if (supportsPowerOn && change.power !== undefined) {
            payload.poweron = change.power;
        }

        return payload;
    }

    private supportsRawState(
        current: DreoDeviceState,
        key: string
    ): boolean {
        return Object.prototype.hasOwnProperty.call(current.raw, key);
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
