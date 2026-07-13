import { DreoValidationError } from "./errors.js";

/**
 * Legacy fallback validator for typed convenience methods.
 *
 * Device-specific command validation is handled by StateConstraintValidator
 * inside DreoDevice before a command is sent.
 *
 * This class remains intentionally simple and provides broad SDK defaults for
 * typed setters that predate resolved device constraints.
 */
export class InputValidator {
    public static requirePercentage(value: number, name = "value"): void {
        this.requireRange(value, 0, 100, name);
    }

    public static requireWindLevel(value: number): void {
        this.requireRange(value, 1, 12, "windLevel");
    }

    public static requireRgbPreset(value: number): void {
        this.requireRange(value, 0, 4, "rgbPreset");
    }

    public static requireRange(
        value: number,
        min: number,
        max: number,
        name = "value"
    ): void {
        if (!Number.isFinite(value)) {
            throw new DreoValidationError(`${name} must be a finite number.`);
        }

        if (value < min || value > max) {
            throw new DreoValidationError(
                `${name} must be between ${min} and ${max}.`
            );
        }
    }
}
