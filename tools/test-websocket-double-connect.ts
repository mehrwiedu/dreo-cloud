import "dotenv/config";

import { DreoSession } from "../packages/dreo-api/src/DreoSession.js";
import { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

async function main(): Promise<void> {
    const email = process.env.DREO_EMAIL;
    const password = process.env.DREO_PASSWORD;
    const region = process.env.DREO_REGION ?? "EU";

    if (!email || !password) {
        throw new Error("DREO_EMAIL and DREO_PASSWORD must be set.");
    }

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
    });

    try {
        console.log("Connecting WebSocket first time...");
        await websocket.connect();

        console.log("Connecting WebSocket second time...");
        await websocket.connect();

        console.log("Double connect test successful.");
    } finally {
        websocket.disconnect();
    }
}

main().catch((error) => {
    console.error("WebSocket double connect test failed:");
    console.error(error);
    process.exit(1);
});
