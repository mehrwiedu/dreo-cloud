import "dotenv/config";

import { AppApi } from "../packages/dreo-api/src/api/AppApi.js";
import { AuthenticatedHttpClient } from "../packages/dreo-api/src/api/AuthenticatedHttpClient.js";
import { DeviceApi } from "../packages/dreo-api/src/api/DeviceApi.js";
import { HttpClient } from "../packages/dreo-api/src/api/HttpClient.js";
import type { DreoLogger } from "../packages/dreo-api/src/DreoLogger.js";
import { DreoSession } from "../packages/dreo-api/src/DreoSession.js";
import { FamilyTreeMapper } from "../packages/dreo-api/src/mappers/FamilyTreeMapper.js";

async function main(): Promise<void> {
    const email = process.env.DREO_EMAIL;
    const password = process.env.DREO_PASSWORD;
    const region = process.env.DREO_REGION ?? "EU";

    if (!email || !password) {
        throw new Error("DREO_EMAIL and DREO_PASSWORD must be set.");
    }

    const logger: DreoLogger = {
        debug(message: string, data?: unknown): void {
            console.log(`[http:debug] ${message}`);

            if (data !== undefined) {
                console.dir(data, { depth: null });
            }
        },

        info(message: string, data?: unknown): void {
            console.log(`[http:info] ${message}`);

            if (data !== undefined) {
                console.dir(data, { depth: null });
            }
        },

        warn(message: string, data?: unknown): void {
            console.warn(`[http:warn] ${message}`);

            if (data !== undefined) {
                console.dir(data, { depth: null });
            }
        },

        error(message: string, data?: unknown): void {
            console.error(`[http:error] ${message}`);

            if (data !== undefined) {
                console.dir(data, { depth: null });
            }
        },
    };

    const session = new DreoSession({
        email,
        password,
        region,
        logger,
    });

    const tokens = await session.login();

    console.log("Initial login successful.");
    console.log(`Region: ${tokens.region}`);

    const http = new HttpClient({
        baseUrl: `https://app-api-${tokens.region}.dreo-tech.com`,
    });

    const authenticatedHttp = new AuthenticatedHttpClient(
        http,
        session,
        logger
    );

    const appApi = new AppApi(authenticatedHttp);
    const deviceApi = new DeviceApi(authenticatedHttp);

    console.log("Loading FamilyTree with valid token...");
    const familyTreeResponse = await appApi.getFamilyRoomDevices();
    const tree = new FamilyTreeMapper().map(familyTreeResponse);

    const firstDevice = tree.devices[0];

    if (!firstDevice) {
        throw new Error("No Dreo devices found in FamilyTree.");
    }

    console.log(`Found device: ${firstDevice.deviceName} (${firstDevice.sn})`);

    console.log("Breaking access token intentionally...");
    session.setAccessTokenForTesting("invalid-token-for-http-logger-test");

    console.log(
        "Requesting device state. This should trigger HTTP 401, refresh and retry..."
    );
    const state = await deviceApi.state(firstDevice.sn);

    console.log("Authenticated HTTP logger refresh test successful.");
    console.log(`State response code: ${state.code}`);
    console.log(`Device SN: ${state.data.sn}`);
}

main().catch((error) => {
    console.error("Authenticated HTTP logger refresh test failed:");
    console.error(error);
    process.exit(1);
});
