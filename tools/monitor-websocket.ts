import "dotenv/config";

import type { DreoLogger } from "../packages/dreo-api/src/DreoLogger.js";
import { DreoSession } from "../packages/dreo-api/src/DreoSession.js";
import { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

const DEFAULT_MONITOR_DURATION_MS = 30_000;

function readMonitorDurationMs(): number {
    const rawValue = process.env.DREO_WS_MONITOR_SECONDS;

    if (!rawValue) {
        return DEFAULT_MONITOR_DURATION_MS;
    }

    const seconds = Number(rawValue);

    if (!Number.isFinite(seconds) || seconds <= 0) {
        throw new Error("DREO_WS_MONITOR_SECONDS must be a positive number.");
    }

    return seconds * 1000;
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function createLogger(): DreoLogger {
    return {
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
}

async function main(): Promise<void> {
    const email = process.env.DREO_EMAIL;
    const password = process.env.DREO_PASSWORD;
    const region = process.env.DREO_REGION ?? "EU";
    const monitorDurationMs = readMonitorDurationMs();

    if (!email || !password) {
        throw new Error("DREO_EMAIL and DREO_PASSWORD must be set.");
    }

    const logger = createLogger();

    const session = new DreoSession({
        email,
        password,
        region,
    });

    const tokens = await session.login();

    console.log("Initial login successful.");
    console.log(`Region: ${tokens.region}`);
    console.log(`Monitoring WebSocket for ${monitorDurationMs / 1000} seconds.`);

    const websocket = new DreoWebSocketClient({
        session,
        logger,
    });

    const unsubscribe = websocket.onReport((report) => {
        console.log("");
        console.log("WebSocket report received:");
        console.dir(report, { depth: null });
    });

    try {
        console.log("Connecting WebSocket...");
        await websocket.connect();

        console.log("WebSocket monitor is running.");
        console.log("Change a DREO device in the app or on the device now.");
        console.log("");

        await wait(monitorDurationMs);

        console.log("");
        console.log("WebSocket monitor finished.");
    } finally {
        unsubscribe();
        websocket.disconnect();
    }
}

main().catch((error) => {
    console.error("WebSocket monitor failed:");
    console.error(error);
    process.exit(1);
});
