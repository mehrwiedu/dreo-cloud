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

    const unsubscribeStateChanged = client.onDeviceStateChanged((event) => {
        console.log("");
        console.log(`State update from ${event.device.name} (${event.device.model})`);
        console.log(JSON.stringify(event.reported, null, 2));
    });

    const unsubscribeDiscovered = client.onDeviceDiscovered((event) => {
        console.log("");
        console.log(
            `Discovered device: ${event.device.name} (${event.device.model})`
        );
    });

    let shuttingDown = false;

    const shutdown = (): void => {
        if (shuttingDown) {
            return;
        }

        shuttingDown = true;
        unsubscribeStateChanged();
        unsubscribeDiscovered();
        client.disconnect();
        console.log("");
        console.log("Disconnected.");
        process.exit(0);
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);

    console.log("Listening for DREO state changes.");
    console.log("Press Ctrl+C to stop.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
