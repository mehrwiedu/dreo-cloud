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

type Hcf007sComponentKey = "fanon" | "lighton" | "atmon";

const HCF007S_COMPONENT_KEYS: readonly Hcf007sComponentKey[] = [
    "fanon",
    "lighton",
    "atmon",
];

export class StateMapper {
    public build(
        current: DreoDeviceState,
        change: StateChange,
        model?: string
    ): Record<string, unknown> {
        if (
            model === "DR-HCF007S" &&
            this.supportsRawState(current, "poweron")
        ) {
            return this.buildHcf007s(current, change);
        }

        return this.buildGeneric(current, change);
    }

    private buildHcf007s(
        current: DreoDeviceState,
        change: StateChange
    ): Record<string, unknown> {
        const payload: Record<string, unknown> = {};

        if (change.atmosphereLight !== undefined) {
            if (change.atmosphereLight) {
                this.activateHcf007sComponent(current, payload, "atmon");
            } else {
                this.deactivateHcf007sComponent(current, payload, "atmon");
            }
        }

        if (change.mainLight !== undefined) {
            if (change.mainLight) {
                this.activateHcf007sComponent(current, payload, "lighton");
            } else {
                this.deactivateHcf007sComponent(current, payload, "lighton");
            }
        }

        if (change.fan !== undefined) {
            if (change.fan) {
                this.activateHcf007sComponent(current, payload, "fanon");
            } else {
                this.deactivateHcf007sComponent(current, payload, "fanon");
            }
        }

        if (change.windLevel !== undefined) {
            payload.windlevel = change.windLevel;

            if (change.windLevel > 0) {
                this.activateHcf007sComponent(current, payload, "fanon");
            }
        }

        if (change.brightness !== undefined) {
            payload.brightness = change.brightness;
            this.activateHcf007sComponent(current, payload, "lighton");
        }

        if (change.colorTemperature !== undefined) {
            payload.colortemp = change.colorTemperature;
            this.activateHcf007sComponent(current, payload, "lighton");
        }

        if (change.rgbPreset !== undefined) {
            payload.rgbpresetsel = change.rgbPreset;

            if (change.rgbPreset > 0) {
                this.activateHcf007sComponent(current, payload, "atmon");
            }
        }

        if (change.atmosphereBrightness !== undefined) {
            payload.atmbri = change.atmosphereBrightness;
            this.activateHcf007sComponent(current, payload, "atmon");
        }

        if (change.power !== undefined) {
            payload.poweron = change.power;

            if (
                change.power &&
                this.hasCompleteHcf007sComponentMask(current) &&
                !this.hasEnabledHcf007sComponent(current)
            ) {
                for (const key of HCF007S_COMPONENT_KEYS) {
                    payload[key] = true;
                }
            }
        }

        return payload;
    }

    private activateHcf007sComponent(
        current: DreoDeviceState,
        payload: Record<string, unknown>,
        targetKey: Hcf007sComponentKey
    ): void {
        const currentlyPowered = current.raw.poweron === true;

        if (!currentlyPowered) {
            payload.poweron = true;

            for (const key of HCF007S_COMPONENT_KEYS) {
                if (this.supportsRawState(current, key)) {
                    payload[key] = key === targetKey;
                }
            }

            return;
        }

        payload[targetKey] = true;
    }

    private deactivateHcf007sComponent(
        current: DreoDeviceState,
        payload: Record<string, unknown>,
        targetKey: Hcf007sComponentKey
    ): void {
        if (current.raw.poweron !== true) {
            payload.poweron = false;
            return;
        }

        const anotherComponentIsEnabled = HCF007S_COMPONENT_KEYS.some(
            (key) =>
                key !== targetKey &&
                this.supportsRawState(current, key) &&
                current.raw[key] === true
        );

        if (anotherComponentIsEnabled) {
            payload[targetKey] = false;
            return;
        }

        payload.poweron = false;
    }

    private hasCompleteHcf007sComponentMask(
        current: DreoDeviceState
    ): boolean {
        return HCF007S_COMPONENT_KEYS.every((key) =>
            this.supportsRawState(current, key)
        );
    }

    private hasEnabledHcf007sComponent(
        current: DreoDeviceState
    ): boolean {
        return HCF007S_COMPONENT_KEYS.some(
            (key) => current.raw[key] === true
        );
    }

    private buildGeneric(
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
