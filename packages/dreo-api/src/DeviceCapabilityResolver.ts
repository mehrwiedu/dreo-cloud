import { DREO_CAPABILITY_REGISTRY } from "./DreoCapabilityRegistry.js";
import type { DeviceCapabilities } from "./models/DeviceCapabilities.js";
import type { ResolvedCapability } from "./models/ResolvedCapability.js";

interface ControlsConfiguration {
    preference?: {
        cmd?: string;
    }[];

    control?: {
        items?: {
            cmd?: string;
        }[];
    }[];

    schedule?: {
        modes?: {
            cmd?: string;
            attention?: string[];
            controls?: {
                cmd?: string[];
            }[];
        }[];
    };
}

export class DeviceCapabilityResolver {
    public resolve(capabilities?: DeviceCapabilities): ResolvedCapability[] {
        if (!capabilities) {
            return [];
        }

        const availableStates = this.collectStateKeys(capabilities);

        return DREO_CAPABILITY_REGISTRY.filter((capability) =>
            capability.required.every((state) => availableStates.has(state))
        ).map((capability) => ({
            id: capability.id,
            states: capability.states.filter((state) =>
                availableStates.has(state)
            ),
        }));
    }

    private collectStateKeys(capabilities: DeviceCapabilities): Set<string> {
        const keys = new Set<string>();

        const controlsConf = capabilities.controlsConf as
            | ControlsConfiguration
            | undefined;

        this.collectPreferenceCommands(controlsConf, keys);
        this.collectControlCommands(controlsConf, keys);
        this.collectScheduleCommands(controlsConf, keys);

        return keys;
    }

    private collectPreferenceCommands(
        controlsConf: ControlsConfiguration | undefined,
        keys: Set<string>
    ): void {
        if (!Array.isArray(controlsConf?.preference)) {
            return;
        }

        for (const preference of controlsConf.preference) {
            if (typeof preference.cmd === "string") {
                keys.add(preference.cmd);
            }
        }
    }

    private collectControlCommands(
        controlsConf: ControlsConfiguration | undefined,
        keys: Set<string>
    ): void {
        if (!Array.isArray(controlsConf?.control)) {
            return;
        }

        for (const control of controlsConf.control) {
            if (!Array.isArray(control.items)) {
                continue;
            }

            for (const item of control.items) {
                if (typeof item.cmd === "string") {
                    keys.add(item.cmd);
                }
            }
        }
    }

    private collectScheduleCommands(
        controlsConf: ControlsConfiguration | undefined,
        keys: Set<string>
    ): void {
        if (!Array.isArray(controlsConf?.schedule?.modes)) {
            return;
        }

        for (const mode of controlsConf.schedule.modes) {
            if (typeof mode.cmd === "string") {
                keys.add(mode.cmd);
            }

            if (Array.isArray(mode.attention)) {
                for (const command of mode.attention) {
                    keys.add(command);
                }
            }

            if (!Array.isArray(mode.controls)) {
                continue;
            }

            for (const control of mode.controls) {
                if (!Array.isArray(control.cmd)) {
                    continue;
                }

                for (const command of control.cmd) {
                    keys.add(command);
                }
            }
        }
    }
}
