export type StateConstraintType =
    | "boolean"
    | "number"
    | "string"
    | "object"
    | "unknown";

export interface BaseStateConstraint {
    type: StateConstraintType;
}

export interface BooleanStateConstraint extends BaseStateConstraint {
    type: "boolean";
}

export interface NumberStateConstraint extends BaseStateConstraint {
    type: "number";

    /**
     * Minimum allowed value, if known.
     */
    min?: number;

    /**
     * Maximum allowed value, if known.
     */
    max?: number;

    /**
     * Increment step, if known.
     */
    step?: number;

    /**
     * Explicit allowed values, if known.
     *
     * This is used for enum-like numeric states such as operating modes.
     */
    allowedValues?: number[];
}

export interface StringStateConstraint extends BaseStateConstraint {
    type: "string";

    /**
     * Explicit allowed values, if known.
     */
    allowedValues?: string[];
}

export interface ObjectStateConstraint extends BaseStateConstraint {
    type: "object";
}

export interface UnknownStateConstraint extends BaseStateConstraint {
    type: "unknown";
}

export type StateConstraint =
    | BooleanStateConstraint
    | NumberStateConstraint
    | StringStateConstraint
    | ObjectStateConstraint
    | UnknownStateConstraint;
