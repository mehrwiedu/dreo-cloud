import "dotenv/config";

import { DreoClient } from "../packages/dreo-api/src/index.js";

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
        const resolvedDevices = await client.getResolvedDevices();

        if (resolvedDevices.length === 0) {
            console.log("No DREO devices were discovered.");
            return;
        }

        console.log(`Discovered ${resolvedDevices.length} DREO device(s):`);
        console.log("");

        for (const resolvedDevice of resolvedDevices) {
            const device = resolvedDevice.device;

            console.log(`Name: ${device.deviceName}`);
            console.log(`Model: ${device.model}`);
            console.log(`Serial number: ${device.sn}`);
            console.log(
                `Resolved capabilities: ${resolvedDevice.capabilities.length}`
            );
            console.log(`Discovered states: ${resolvedDevice.states.length}`);
            console.log(
                `Unassigned known states: ${resolvedDevice.unassignedKnownStates.length}`
            );
            console.log(
                `Unknown states: ${resolvedDevice.unknownStates.length}`
            );
            console.log("---");
        }
    } finally {
        client.disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
