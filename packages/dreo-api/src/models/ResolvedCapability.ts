import type { DiscoveredState } from "./DiscoveredState.js";

export type ResolvedCapabilityId =
    | "power"
    | "fan"
    | "mainLight"
    | "ambientLight"
    | "diagnostic"
    | "configuration"
    | "information"
    | "unknown";

export interface ResolvedCapability {
    id: ResolvedCapabilityId;
    states: string[];

    /**
     * Optional detailed state metadata for adapter-friendly consumption.
     *
     * This is populated by ResolvedDeviceResolver after capabilities from
     * different sources have been merged.
     */
    stateDetails?: DiscoveredState[];
}
