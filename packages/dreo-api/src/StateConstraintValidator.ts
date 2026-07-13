import { DreoValidationError } from "./errors.js";
import type { StateConstraint } from "./models/StateConstraint.js";

export class StateConstraintValidator {
    public validate(
        stateKey: string,
        value: unknown,
        constraint: StateConstraint | undefined
    ): void {
        if (!constraint) {
            return;
        }

        switch (constraint.type) {
            case "boolean":
                this.requireBoolean(stateKey, value);
                return;

            case "number":
                this.requireNumber(stateKey, value, constraint);
                return;

            case "string":
                this.requireString(stateKey, value, constraint);
                return;

            case "object":
                this.requireObject(stateKey, value);
                return;

            case "unknown":
                return;

            default:
                return;
        }
    }

    private requireBoolean(stateKey: string, value: unknown): void {
        if (typeof value !== "boolean") {
            throw new DreoValidationError(
                `${stateKey} must be a boolean value.`
            );
        }
    }

    private requireNumber(
        stateKey: string,
        value: unknown,
        constraint: Extract<StateConstraint, { type: "number" }>
    ): void {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new DreoValidationError(
                `${stateKey} must be a finite number.`
            );
        }

        if (constraint.allowedValues?.length) {
            if (!constraint.allowedValues.includes(value)) {
                throw new DreoValidationError(
                    `${stateKey} must be one of: ${constraint.allowedValues.join(
                        ", "
                    )}.`
                );
            }

            return;
        }

        if (constraint.min !== undefined && value < constraint.min) {
            throw new DreoValidationError(
                `${stateKey} must be greater than or equal to ${constraint.min}.`
            );
        }

        if (constraint.max !== undefined && value > constraint.max) {
            throw new DreoValidationError(
                `${stateKey} must be less than or equal to ${constraint.max}.`
            );
        }

        if (constraint.step !== undefined) {
            this.requireStep(stateKey, value, constraint.step, constraint.min);
        }
    }

    private requireStep(
        stateKey: string,
        value: number,
        step: number,
        min: number | undefined
    ): void {
        if (step === 0) {
            return;
        }

        const base = min ?? 0;
        const remainder = (value - base) / step;

        if (!Number.isInteger(remainder)) {
            throw new DreoValidationError(`${stateKey} must use step ${step}.`);
        }
    }

    private requireString(
        stateKey: string,
        value: unknown,
        constraint: Extract<StateConstraint, { type: "string" }>
    ): void {
        if (typeof value !== "string") {
            throw new DreoValidationError(`${stateKey} must be a string.`);
        }

        if (constraint.allowedValues?.length) {
            if (!constraint.allowedValues.includes(value)) {
                throw new DreoValidationError(
                    `${stateKey} must be one of: ${constraint.allowedValues.join(
                        ", "
                    )}.`
                );
            }
        }
    }

    private requireObject(stateKey: string, value: unknown): void {
        if (
            typeof value !== "object" ||
            value === null ||
            Array.isArray(value)
        ) {
            throw new DreoValidationError(`${stateKey} must be an object.`);
        }
    }
}
