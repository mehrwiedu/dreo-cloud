import "dotenv/config";

import { AppApi } from "../packages/dreo-api/src/api/AppApi.js";
import { AuthenticatedHttpClient } from "../packages/dreo-api/src/api/AuthenticatedHttpClient.js";
import { DeviceApi } from "../packages/dreo-api/src/api/DeviceApi.js";
import { HttpClient } from "../packages/dreo-api/src/api/HttpClient.js";
import { DeviceCapabilityResolver } from "../packages/dreo-api/src/DeviceCapabilityResolver.js";
import { DreoClient } from "../packages/dreo-api/src/DreoClient.js";
import { DreoSession } from "../packages/dreo-api/src/DreoSession.js";
import { ResolvedDeviceResolver } from "../packages/dreo-api/src/ResolvedDeviceResolver.js";

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

    const http = new HttpClient({
        baseUrl: `https://app-api-${tokens.region}.dreo-tech.com`,
    });

    const authenticatedHttp = new AuthenticatedHttpClient(http, session);

    const appApi = new AppApi(authenticatedHttp);
    const deviceApi = new DeviceApi(authenticatedHttp);

    const client = new DreoClient(appApi, deviceApi);

    const capabilityResolver = new DeviceCapabilityResolver();
    const resolvedDeviceResolver = new ResolvedDeviceResolver();

    const tree = await client.getFamilyTree();

    for (const device of tree.devices) {
        console.log("");
        console.log("==================================================");
        console.log(`${device.deviceName} (${device.model})`);
        console.log(device.sn);
        console.log("==================================================");

        console.log("");
        console.log("FamilyTree capabilities:");
        console.dir(device.capabilities, { depth: null });

        console.log("");
        console.log("FamilyTree resolved capabilities:");
        console.log("-------------------------------");

        const familyCapabilities = capabilityResolver.resolve(
            device.capabilities ?? {}
        );

        if (familyCapabilities.length === 0) {
            console.log("None");
        } else {
            for (const capability of familyCapabilities) {
                console.log(capability.id);

                for (const stateKey of capability.states) {
                    console.log(`  • ${stateKey}`);
                }

                console.log("");
            }
        }

        console.log("");
        console.log("Initial device state:");

        const state = await deviceApi.state(device.sn);

        console.dir(state, { depth: null });

        const resolved = resolvedDeviceResolver.resolve(device, state);

        console.log("");
        console.log("Resolved capabilities:");
        console.log("----------------------");

        for (const capability of resolved.capabilities) {
            console.log(capability.id);

            for (const stateKey of capability.states) {
                console.log(`  • ${stateKey}`);
            }

            console.log("");
        }

        console.log("Unassigned states:");
        console.log("------------------");

        if (resolved.unassignedStates.length === 0) {
            console.log("None");
        } else {
            for (const discovered of resolved.unassignedStates) {
                const knownIcon = discovered.known ? "✓" : "?";
                const access = discovered.writable ? "RW" : "RO";

                console.log(
                    `${discovered.key.padEnd(24)} ` +
                        `${discovered.valueType.padEnd(8)} ` +
                        `${access.padEnd(2)}  ` +
                        `${discovered.category.padEnd(13)} ` +
                        `${knownIcon} ${discovered.description}`
                );
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
