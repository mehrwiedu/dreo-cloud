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
                constraint,
            };
        });
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
