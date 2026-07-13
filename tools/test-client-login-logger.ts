import "dotenv/config";

import { DreoClient } from "../packages/dreo-api/src/DreoClient.js";
import type { DreoLogger } from "../packages/dreo-api/src/DreoLogger.js";

async function main(): Promise<void> {
    const email = process.env.DREO_EMAIL;
    const password = process.env.DREO_PASSWORD;
    const region = process.env.DREO_REGION ?? "EU";

    if (!email || !password) {
        throw new Error("DREO_EMAIL and DREO_PASSWORD must be set.");
    }

    const logger: DreoLogger = {
        debug(message: string, data?: unknown): void {
            console.log(`[client:debug] ${message}`);

            if (data !== undefined) {
                console.dir(data, { depth: null });
            }
        },

        info(message: string, data?: unknown): void {
            console.log(`[client:info] ${message}`);

            if (data !== undefined) {
                console.dir(data, { depth: null });
            }
        },

        warn(message: string, data?: unknown): void {
            console.warn(`[client:warn] ${message}`);

            if (data !== undefined) {
                console.dir(data, { depth: null });
            }
        },

        error(message: string, data?: unknown): void {
            console.error(`[client:error] ${message}`);

            if (data !== undefined) {
                console.dir(data, { depth: null });
            }
        },
    };

    console.log("Logging in through DreoClient with logger...");

    const client = await DreoClient.login({
        email,
        password,
        region,
        logger,
    });

    try {
        const devices = client.getDevices();

        console.log(`Client login successful. Device count: ${devices.length}`);

        for (const device of devices) {
            console.log(`Device: ${device.name} (${device.sn})`);
        }
    } finally {
        client.disconnect();
    }

    console.log("DreoClient logger test successful.");
}

main().catch((error) => {
    console.error("DreoClient logger test failed:");
    console.error(error);
    process.exit(1);
});
