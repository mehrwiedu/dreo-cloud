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

    console.log("Starting WebSocket connect without awaiting it...");
    const connectPromise = websocket.connect();

    console.log(
        "Disconnecting immediately while connect may still be pending..."
    );
    websocket.disconnect();

    try {
        await connectPromise;

        console.log(
            "Connect promise resolved. This is acceptable if the connection opened before disconnect was processed."
        );
    } catch (error) {
        console.log(
            "Connect promise rejected after disconnect. This is acceptable."
        );

        if (error instanceof Error) {
            console.log(`Reason: ${error.message}`);
        }
    }

    console.log("Running normal connect again after interrupted connect...");
    await websocket.connect();

    console.log("Reconnect after interrupted connect successful.");

    websocket.disconnect();

    console.log("Disconnect during connect test successful.");
}

main().catch((error) => {
    console.error("WebSocket disconnect during connect test failed:");
    console.error(error);
    process.exit(1);
});
