import "dotenv/config";

import { DreoClient } from "../packages/dreo-api/src/DreoClient.js";
import type { StateConstraint } from "../packages/dreo-api/src/models/StateConstraint.js";

async function main(): Promise<void> {
    const email = process.env.DREO_EMAIL;
    const password = process.env.DREO_PASSWORD;
    const region = process.env.DREO_REGION ?? "EU";

    if (!email || !password) {
        throw new Error("DREO_EMAIL and DREO_PASSWORD must be set.");
    }

    const client = await DreoClient.login({
        email,
        password,
        region,
    });

    try {
        console.log("Loading resolved devices...");
        const resolvedDevices = await client.getResolvedDevices();

        console.log("");
        console.log(`Resolved devices: ${resolvedDevices.length}`);

        for (const resolvedDevice of resolvedDevices) {
            console.log("");
            console.log("==================================================");
            console.log(
                `${resolvedDevice.device.deviceName} (${resolvedDevice.device.model})`
            );
            console.log(resolvedDevice.device.sn);
            console.log("==================================================");

            console.log("");
            console.log(`Discovered states: ${resolvedDevice.states.length}`);
            console.log(
                `Resolved capabilities: ${resolvedDevice.capabilities.length}`
            );
            console.log(
                `Unassigned known states: ${resolvedDevice.unassignedKnownStates.length}`
            );
            console.log(
                `Unknown states: ${resolvedDevice.unknownStates.length}`
            );

            console.log("");
            console.log("Capabilities:");

            for (const capability of resolvedDevice.capabilities) {
                console.log(`  - ${capability.id}`);

                for (const state of capability.stateDetails ?? []) {
                    console.log(
                        `      • ${state.key} | type=${
                            state.valueType
                        } | writable=${state.writable} | category=${
                            state.category
                        } | constraint=${formatConstraint(state.constraint)}`
                    );
                }
            }

            console.log("");
            console.log("Unassigned known states:");

            if (resolvedDevice.unassignedKnownStates.length === 0) {
                console.log("  None");
            } else {
                for (const state of resolvedDevice.unassignedKnownStates) {
                    console.log(
                        `  - ${state.key} | type=${
                            state.valueType
                        } | writable=${state.writable} | category=${
                            state.category
                        } | constraint=${formatConstraint(state.constraint)}`
                    );
                }
            }

            console.log("");
            console.log("Unknown states:");

            if (resolvedDevice.unknownStates.length === 0) {
                console.log("  None");
            } else {
                for (const state of resolvedDevice.unknownStates) {
                    console.log(
                        `  - ${state.key} | type=${
                            state.valueType
                        } | constraint=${formatConstraint(state.constraint)}`
                    );
                }
            }
        }

        console.log("");
        console.log("Resolved devices test successful.");
    } finally {
        client.disconnect();
    }
}

function formatConstraint(constraint: StateConstraint | undefined): string {
    if (!constraint) {
        return "none";
    }

    switch (constraint.type) {
        case "boolean":
        case "object":
        case "unknown":
            return constraint.type;

        case "string":
            return formatAllowedValues(
                constraint.type,
                constraint.allowedValues
            );

        case "number": {
            const parts = [`type=${constraint.type}`];

            if (constraint.min !== undefined) {
                parts.push(`min=${constraint.min}`);
            }

            if (constraint.max !== undefined) {
                parts.push(`max=${constraint.max}`);
            }

            if (constraint.step !== undefined) {
                parts.push(`step=${constraint.step}`);
            }

            if (constraint.allowedValues?.length) {
                parts.push(`allowed=[${constraint.allowedValues.join(",")}]`);
            }

            return parts.join(",");
        }

        default:
            return "unknown";
    }
}

function formatAllowedValues(
    type: string,
    allowedValues: readonly string[] | undefined
): string {
    if (!allowedValues?.length) {
        return type;
    }

    return `type=${type},allowed=[${allowedValues.join(",")}]`;
}

main().catch((error) => {
    console.error("Resolved devices test failed:");
    console.error(error);
    process.exit(1);
});
