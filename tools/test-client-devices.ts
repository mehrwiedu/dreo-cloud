import "dotenv/config";

import { DreoClient } from "../packages/dreo-api/src/DreoClient.js";

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
        const tree = await client.getFamilyTree();

        console.log("");
        console.log("Devices:");
        console.log("--------");

        for (const device of tree.devices) {
            console.log(`${device.deviceName} (${device.model})`);
            console.log(`  SN: ${device.sn}`);
        }
    } finally {
        client.disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
