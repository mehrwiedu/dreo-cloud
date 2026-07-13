import "dotenv/config";

import type { DreoLogger } from "../packages/dreo-api/src/DreoLogger.js";
import { DreoSession } from "../packages/dreo-api/src/DreoSession.js";
import { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

async function main(): Promise<void> {
    const email = process.env.DREO_EMAIL;
    const password = process.env.DREO_PASSWORD;
    const region = process.env.DREO_REGION ?? "EU";

    if (!email || !password) {
        throw new Error("DREO_EMAIL and DREO_PASSWORD must be set.");
    }

    const logger: DreoLogger = {
        debug(message: string, data?: unknown): void {
            console.log(`[ws:debug] ${message}`);

            if (data !== undefined) {
                console.dir(data, { depth: null });
            }
        },

        info(message: string, data?: unknown): void {
            console.log(`[ws:info] ${message}`);

            if (data !== undefined) {
                console.dir(data, { depth: null });
            }
        },

        warn(message: string, data?: unknown): void {
            console.warn(`[ws:warn] ${message}`);

            if (data !== undefined) {
                console.dir(data, { depth: null });
            }
        },

        error(message: string, data?: unknown): void {
            console.error(`[ws:error] ${message}`);

            if (data !== undefined) {
                console.dir(data, { depth: null });
            }
        },
    };

    const session = new DreoSession({
        email,
        password,
        region,
    });

    const tokens = await session.login();

    console.log("Initial login successful.");
    console.log(`Region: ${tokens.region}`);

    const websocket = new DreoWebSocketClient({
        session,
        logger,
    });

    try {
        console.log("Connecting WebSocket with explicit logger...");
        await websocket.connect();

        console.log("Disconnecting WebSocket...");
        websocket.disconnect();

        console.log("WebSocket logger test successful.");
    } finally {
        websocket.disconnect();
    }
}

main().catch((error) => {
    console.error("WebSocket logger test failed:");
    console.error(error);
    process.exit(1);
});
