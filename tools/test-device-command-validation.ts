import "dotenv/config";

import { DreoClient } from "../packages/dreo-api/src/DreoClient.js";
import { DreoValidationError } from "../packages/dreo-api/src/errors.js";

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
        const device = client.getDeviceByName("Standventilator");

        if (!device) {
            throw new Error("Standventilator not found.");
        }

        console.log(`Testing command validation for ${device.name}`);
        console.log(`Model: ${device.model}`);
        console.log(`SN: ${device.sn}`);

        let invalidCommandWasRejected = false;

        try {
            await device.setWindLevel(9);
        } catch (error) {
            if (error instanceof DreoValidationError) {
                invalidCommandWasRejected = true;
                console.log("Invalid wind level was rejected as expected.");
                console.log(`Validation message: ${error.message}`);
            } else {
                throw error;
            }
        }

        if (!invalidCommandWasRejected) {
            throw new Error("Invalid wind level was not rejected.");
        }

        console.log("Sending valid wind level 8...");
        await device.setWindLevel(8);

        console.log("Valid wind level was accepted.");
        console.log("Device command validation test successful.");
    } finally {
        client.disconnect();
    }
}

main().catch((error: unknown) => {
    console.error("Device command validation test failed:");
    console.error(error);
    process.exitCode = 1;
});
