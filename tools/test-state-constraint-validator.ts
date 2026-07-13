import { StateConstraintValidator } from "../packages/dreo-api/src/StateConstraintValidator.js";
import { DreoValidationError } from "../packages/dreo-api/src/errors.js";
import type { StateConstraint } from "../packages/dreo-api/src/models/StateConstraint.js";

const validator = new StateConstraintValidator();

function expectValid(
    name: string,
    value: unknown,
    constraint: StateConstraint | undefined
): void {
    validator.validate(name, value, constraint);
}

function expectInvalid(
    name: string,
    value: unknown,
    constraint: StateConstraint | undefined
): void {
    try {
        validator.validate(name, value, constraint);
    } catch (error) {
        if (error instanceof DreoValidationError) {
            return;
        }

        throw error;
    }

    throw new Error(`Expected validation error for ${name}.`);
}

expectValid("poweron", true, {
    type: "boolean",
});

expectInvalid("poweron", "true", {
    type: "boolean",
});

expectValid("brightness", 50, {
    type: "number",
    min: 0,
    max: 100,
    step: 1,
});

expectInvalid("brightness", 150, {
    type: "number",
    min: 0,
    max: 100,
    step: 1,
});

expectInvalid("brightness", -1, {
    type: "number",
    min: 0,
    max: 100,
    step: 1,
});

expectInvalid("brightness", 50.5, {
    type: "number",
    min: 0,
    max: 100,
    step: 1,
});

expectValid("windlevel", 8, {
    type: "number",
    min: 1,
    max: 8,
    step: 1,
});

expectInvalid("windlevel", 9, {
    type: "number",
    min: 1,
    max: 8,
    step: 1,
});

expectInvalid("windlevel", 0, {
    type: "number",
    min: 1,
    max: 8,
    step: 1,
});

expectValid("mode", 6, {
    type: "number",
    step: 1,
    allowedValues: [1, 2, 3, 4, 5, 6],
});

expectInvalid("mode", 99, {
    type: "number",
    step: 1,
    allowedValues: [1, 2, 3, 4, 5, 6],
});

expectInvalid("mode", "auto", {
    type: "number",
    step: 1,
    allowedValues: [1, 2, 3, 4, 5, 6],
});

expectValid("wifi_ssid", "My WiFi", {
    type: "string",
});

expectInvalid("wifi_ssid", 123, {
    type: "string",
});

expectValid(
    "timeron",
    {},
    {
        type: "object",
    }
);

expectInvalid("timeron", [], {
    type: "object",
});

expectInvalid("timeron", null, {
    type: "object",
});

expectValid("unknown_state", "anything", undefined);

expectValid("unknown_state", "anything", {
    type: "unknown",
});

console.log("State constraint validator test successful.");
