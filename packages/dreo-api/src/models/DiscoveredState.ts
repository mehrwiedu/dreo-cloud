import type { StateConstraint } from "./StateConstraint.js";

export type DiscoveredStateType =
    | "boolean"
    | "number"
    | "string"
    | "object"
    | "unknown";

export type DiscoveredStateCategory =
    | "control"
    | "sensor"
    | "diagnostic"
    | "configuration"
    | "information"
    | "unknown";

export interface DiscoveredState {
    key: string;
    valueType: DiscoveredStateType;
    writable: boolean;
    category: DiscoveredStateCategory;
    description: string;
    known: boolean;

    /**
     * Optional value constraint for safe adapter and SDK usage.
     *
     * This can describe numeric ranges, enum-like allowed values,
     * boolean states, string values, object values, or unknown constraints.
     */
    constraint?: StateConstraint;
}
