import {
    DREO_STATE_REGISTRY,
    type DreoStateDefinition,
} from "./DreoStateRegistry.js";
import { DREO_CAPABILITY_REGISTRY } from "./DreoCapabilityRegistry.js";

import type { DiscoveredState } from "./models/DiscoveredState.js";
import type {
    DeviceMixedState,
    DeviceStateResponse,
} from "./models/DeviceStateResponse.js";
import type { ResolvedCapability } from "./models/ResolvedCapability.js";

export class DeviceResolver {
    public getRawStateKeys(response: DeviceStateResponse): string[] {
        return this.getMixedStateKeys(response.data.mixed);
    }

    public getMixedStateKeys(mixed: DeviceMixedState): string[] {
        return Object.keys(mixed).sort();
    }

    public discoverStates(response: DeviceStateResponse): DiscoveredState[] {
        return this.discoverMixedStates(response.data.mixed);
    }

    public resolveCapabilities(
        response: DeviceStateResponse
    ): ResolvedCapability[] {
        return this.resolveMixedCapabilities(response.data.mixed);
    }

    public resolveMixedCapabilities(
        mixed: DeviceMixedState
    ): ResolvedCapability[] {
        const availableStates = new Set(Object.keys(mixed));

        return DREO_CAPABILITY_REGISTRY.filter((capability) =>
            capability.required.every((state) => availableStates.has(state))
        ).map((capability) => ({
            id: capability.id,
            states: capability.states.filter((state) =>
                availableStates.has(state)
            ),
        }));
    }

    public discoverMixedStates(mixed: DeviceMixedState): DiscoveredState[] {
        return Object.entries(mixed)
            .map(([key, value]) => {
                const registryDefinition = this.getRegistryDefinition(key);
                const detectedType = this.detectValueType(value);

                return {
                    key,
                    valueType: detectedType,
                    writable: registryDefinition?.writable ?? false,
                    category: registryDefinition?.category ?? "unknown",
                    description:
                        registryDefinition?.description ?? "Unknown Dreo state",
                    known: registryDefinition !== undefined,
                    constraint: registryDefinition?.constraint,
                };
            })
            .sort((a, b) => a.key.localeCompare(b.key));
    }

    private getRegistryDefinition(
        key: string
    ): DreoStateDefinition | undefined {
        return DREO_STATE_REGISTRY[key];
    }

    private detectValueType(value: unknown): DiscoveredState["valueType"] {
        if (
            typeof value !== "object" ||
            value === null ||
            !("state" in value)
        ) {
            return "unknown";
        }

        const state = (value as { state: unknown }).state;

        switch (typeof state) {
            case "boolean":
                return "boolean";

            case "number":
                return "number";

            case "string":
                return "string";

            case "object":
                return "object";

            default:
                return "unknown";
        }
    }
}
