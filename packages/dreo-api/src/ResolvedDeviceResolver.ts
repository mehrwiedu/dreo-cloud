import { CapabilityMerger } from "./CapabilityMerger.js";
import { DeviceCapabilityResolver } from "./DeviceCapabilityResolver.js";
import { DeviceResolver } from "./DeviceResolver.js";
import { StateConstraintResolver } from "./StateConstraintResolver.js";

import type { Device } from "./models/Device.js";
import type { DeviceStateResponse } from "./models/DeviceStateResponse.js";
import type { DiscoveredState } from "./models/DiscoveredState.js";
import type { ResolvedCapability } from "./models/ResolvedCapability.js";
import type { ResolvedDevice } from "./models/ResolvedDevice.js";
import type { StateConstraint } from "./models/StateConstraint.js";

export class ResolvedDeviceResolver {
    private readonly deviceResolver = new DeviceResolver();

    private readonly capabilityResolver = new DeviceCapabilityResolver();

    private readonly capabilityMerger = new CapabilityMerger();

    private readonly constraintResolver = new StateConstraintResolver();

    public resolve(device: Device, state: DeviceStateResponse): ResolvedDevice {
        const states = this.withResolvedConstraints(
            this.deviceResolver.discoverStates(state),
            this.constraintResolver.resolve(device.capabilities)
        );

        const stateCapabilities =
            this.deviceResolver.resolveCapabilities(state);

        const familyCapabilities = this.capabilityResolver.resolve(
            device.capabilities ?? {}
        );

        const capabilities = this.withStateDetails(
            this.capabilityMerger.merge(stateCapabilities, familyCapabilities),
            states
        );

        const assignedStates = new Set(
            capabilities.flatMap((capability) => capability.states)
        );

        const unassignedStates = states.filter(
            (state) => !assignedStates.has(state.key)
        );

        const unassignedKnownStates = unassignedStates.filter(
            (state) => state.known
        );

        const unknownStates = unassignedStates.filter((state) => !state.known);

        return {
            device,
            state,
            capabilities,
            states,
            unassignedStates,
            unassignedKnownStates,
            unknownStates,
        };
    }

    private withResolvedConstraints(
        states: DiscoveredState[],
        resolvedConstraints: Map<string, StateConstraint>
    ): DiscoveredState[] {
        if (resolvedConstraints.size === 0) {
            return states;
        }

        return states.map((state) => {
            const constraint = resolvedConstraints.get(state.key);

            if (!constraint) {
                return state;
            }

            return {
                ...state,
                constraint: this.mergeResolvedConstraint(
                    state.constraint,
                    constraint
                ),
            };
        });
    }

    /**
     * Combines the general registry constraint with device-specific metadata.
     *
     * The registry remains authoritative when the device configuration
     * reports a conflicting type. Device-specific details may refine a
     * constraint only when both sources agree on the type.
     */
    private mergeResolvedConstraint(
        registryConstraint: StateConstraint | undefined,
        resolvedConstraint: StateConstraint
    ): StateConstraint {
        if (!registryConstraint) {
            return resolvedConstraint;
        }

        if (registryConstraint.type !== resolvedConstraint.type) {
            return registryConstraint;
        }

        switch (registryConstraint.type) {
            case "number": {
                if (resolvedConstraint.type !== "number") {
                    return registryConstraint;
                }

                const minimum = this.mergeMinimum(
                    registryConstraint.min,
                    resolvedConstraint.min
                );
                const maximum = this.mergeMaximum(
                    registryConstraint.max,
                    resolvedConstraint.max
                );

                return {
                    type: "number",
                    min: minimum,
                    max: maximum,
                    step:
                        resolvedConstraint.step ??
                        registryConstraint.step,
                    allowedValues: this.mergeNumberAllowedValues(
                        registryConstraint.allowedValues,
                        resolvedConstraint.allowedValues,
                        minimum,
                        maximum
                    ),
                };
            }

            case "string":
                if (resolvedConstraint.type !== "string") {
                    return registryConstraint;
                }

                return {
                    type: "string",
                    allowedValues: this.mergeAllowedValues(
                        registryConstraint.allowedValues,
                        resolvedConstraint.allowedValues
                    ),
                };

            case "boolean":
            case "object":
            case "unknown":
            default:
                return resolvedConstraint;
        }
    }

    private mergeMinimum(
        registryValue: number | undefined,
        resolvedValue: number | undefined
    ): number | undefined {
        if (registryValue === undefined) {
            return resolvedValue;
        }

        if (resolvedValue === undefined) {
            return registryValue;
        }

        return Math.max(registryValue, resolvedValue);
    }

    private mergeMaximum(
        registryValue: number | undefined,
        resolvedValue: number | undefined
    ): number | undefined {
        if (registryValue === undefined) {
            return resolvedValue;
        }

        if (resolvedValue === undefined) {
            return registryValue;
        }

        return Math.min(registryValue, resolvedValue);
    }

    private mergeNumberAllowedValues(
        registryValues: number[] | undefined,
        resolvedValues: number[] | undefined,
        minimum: number | undefined,
        maximum: number | undefined
    ): number[] | undefined {
        const mergedValues = this.mergeAllowedValues(
            registryValues,
            resolvedValues
        );

        if (!mergedValues?.length) {
            return undefined;
        }

        const filteredValues = mergedValues.filter(
            (value) =>
                (minimum === undefined || value >= minimum) &&
                (maximum === undefined || value <= maximum)
        );

        if (filteredValues.length === 0) {
            return undefined;
        }

        return [...new Set(filteredValues)].sort(
            (left, right) => left - right
        );
    }

    private mergeAllowedValues<T extends string | number>(
        registryValues: T[] | undefined,
        resolvedValues: T[] | undefined
    ): T[] | undefined {
        if (!registryValues?.length) {
            return resolvedValues;
        }

        if (!resolvedValues?.length) {
            return registryValues;
        }

        const resolvedValueSet = new Set<T>(resolvedValues);
        const intersection = registryValues.filter((value) =>
            resolvedValueSet.has(value)
        );

        /*
         * An empty intersection indicates conflicting metadata. In that case,
         * preserve the confirmed registry values instead of accidentally
         * removing validation altogether.
         */
        return intersection.length > 0
            ? intersection
            : registryValues;
    }

    private withStateDetails(
        capabilities: ResolvedCapability[],
        states: DiscoveredState[]
    ): ResolvedCapability[] {
        const statesByKey = new Map(states.map((state) => [state.key, state]));

        return capabilities.map((capability) => ({
            ...capability,
            stateDetails: capability.states
                .map((stateKey) => statesByKey.get(stateKey))
                .filter(
                    (state): state is DiscoveredState => state !== undefined
                ),
        }));
    }
}
