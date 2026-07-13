import type { Device } from "./Device.js";
import type { DiscoveredState } from "./DiscoveredState.js";
import type { DeviceStateResponse } from "./DeviceStateResponse.js";
import type { ResolvedCapability } from "./ResolvedCapability.js";

export interface ResolvedDevice {
    /**
     * Device information from the FamilyTree.
     */
    device: Device;

    /**
     * Complete initial state returned by the cloud.
     */
    state: DeviceStateResponse;

    /**
     * Merged capabilities resolved from all available sources.
     */
    capabilities: ResolvedCapability[];

    /**
     * All discovered states.
     */
    states: DiscoveredState[];

    /**
     * States that are currently not assigned to any capability.
     *
     * This includes both known-but-unassigned states and completely unknown
     * states.
     */
    unassignedStates: DiscoveredState[];

    /**
     * Known states that are currently not assigned to any capability.
     *
     * These states are understood by the registry, but their functional
     * capability mapping is intentionally still open.
     */
    unassignedKnownStates: DiscoveredState[];

    /**
     * States that are not yet known by the registry.
     *
     * These are candidates for further reverse engineering.
     */
    unknownStates: DiscoveredState[];
}
