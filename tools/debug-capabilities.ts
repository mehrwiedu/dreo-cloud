/**
 * Research tool.
 *
 * Dumps the capability information returned by the FamilyTree endpoint.
 *
 * This tool was used while developing the FamilyTree-based capability
 * resolution pipeline:
 *
 * - DeviceCapabilityResolver
 * - CapabilityMerger
 * - ResolvedDeviceResolver
 * - ResolvedDevice
 */

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

        for (const device of tree.devices) {
            console.log("");
            console.log("==================================================");
            console.log(`${device.deviceName} (${device.model})`);
            console.log(device.sn);
            console.log("==================================================");

            console.dir(device.capabilities, { depth: null });
        }
    } finally {
        client.disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
