import "dotenv/config";

import {
    DreoClient,
    type DreoDeviceDiscoveredEvent,
    type DreoDeviceStateChangeEvent,
} from "../packages/dreo-api/src/DreoClient.js";
import type { ResolvedDevice } from "../packages/dreo-api/src/models/ResolvedDevice.js";
import type { DreoWebSocketReply } from "../packages/dreo-api/src/websocket/DreoWebSocketReply.js";

interface DreoClientTestAccess {
    devices: Map<string, unknown>;
    resolvedDevices: Map<string, ResolvedDevice>;
    applyWebSocketReport(report: DreoWebSocketReply): Promise<void>;
}

function getTestAccess(client: DreoClient): DreoClientTestAccess {
    return client as unknown as DreoClientTestAccess;
}

function selectTargetDevice(
    resolvedDevices: readonly ResolvedDevice[],
    requestedSerialNumber?: string
): ResolvedDevice {
    if (requestedSerialNumber) {
        const requestedDevice = resolvedDevices.find(
            (resolvedDevice) =>
                resolvedDevice.device.sn === requestedSerialNumber
        );

        if (!requestedDevice) {
            throw new Error(
                `Requested test device ${requestedSerialNumber} was not found.`
            );
        }

        return requestedDevice;
    }

    const humidifier = resolvedDevices.find(
        (resolvedDevice) => resolvedDevice.device.model === "DR-HHM001S"
    );

    if (humidifier) {
        return humidifier;
    }

    const fallbackDevice = resolvedDevices.at(-1);

    if (!fallbackDevice) {
        throw new Error("No DREO devices are available for the test.");
    }

    return fallbackDevice;
}

async function main(): Promise<void> {
    const email = process.env.DREO_EMAIL;
    const password = process.env.DREO_PASSWORD;
    const region = process.env.DREO_REGION ?? "EU";
    const requestedSerialNumber =
        process.env.DREO_RUNTIME_DISCOVERY_SN?.trim() || undefined;

    if (!email || !password) {
        throw new Error("DREO_EMAIL and DREO_PASSWORD must be set.");
    }

    console.log("Logging in to DREO...");

    const client = await DreoClient.login({
        email,
        password,
        region,
        logger: {
            debug: (message, data) => {
                console.log(
                    `[sdk:debug] ${message}`,
                    data === undefined ? "" : data
                );
            },
            info: (message, data) => {
                console.log(
                    `[sdk:info] ${message}`,
                    data === undefined ? "" : data
                );
            },
            warn: (message, data) => {
                console.warn(
                    `[sdk:warn] ${message}`,
                    data === undefined ? "" : data
                );
            },
            error: (message, data) => {
                console.error(
                    `[sdk:error] ${message}`,
                    data === undefined ? "" : data
                );
            },
        },
    });

    let unsubscribeDiscovered: (() => void) | undefined;
    let unsubscribeStateChanged: (() => void) | undefined;

    try {
        const resolvedDevices = await client.getResolvedDevices();
        const target = selectTargetDevice(
            resolvedDevices,
            requestedSerialNumber
        );
        const serialNumber = target.device.sn;
        const testAccess = getTestAccess(client);

        console.log("");
        console.log("Runtime discovery test");
        console.log("----------------------");
        console.log(
            `Target: ${target.device.deviceName} (${target.device.model})`
        );
        console.log(`SN: ${serialNumber}`);
        console.log(
            `Initial registered devices: ${client.getDevices().length}`
        );

        const discoveredEvents: DreoDeviceDiscoveredEvent[] = [];
        const stateChangeEvents: DreoDeviceStateChangeEvent[] = [];

        const getDiscoveredEventCount = (): number => discoveredEvents.length;
        const getStateChangeEventCount = (): number => stateChangeEvents.length;

        unsubscribeDiscovered = client.onDeviceDiscovered((event) => {
            discoveredEvents.push(event);

            console.log(
                `Discovery event: ${event.resolvedDevice.device.deviceName} (${event.device.sn})`
            );
        });

        unsubscribeStateChanged = client.onDeviceStateChanged((event) => {
            if (event.device.sn !== serialNumber) {
                return;
            }

            stateChangeEvents.push(event);

            console.log(
                `State-change event ${getStateChangeEventCount()}: ${JSON.stringify(
                    event.reported
                )}`
            );
        });

        console.log("");
        console.log("Removing the target only from the local client cache...");

        const removedDevice = testAccess.devices.delete(serialNumber);
        const removedResolvedDevice =
            testAccess.resolvedDevices.delete(serialNumber);

        if (!removedDevice || !removedResolvedDevice) {
            throw new Error(
                "The target device could not be removed from the local test cache."
            );
        }

        if (client.getDevice(serialNumber)) {
            throw new Error(
                "The target device is still registered after local removal."
            );
        }

        console.log("Injecting the first synthetic device-online report...");

        await testAccess.applyWebSocketReport({
            method: "device-online",
            devicesn: serialNumber,
            reported: {
                connected: true,
            },
        });

        const rediscoveredDevice = client.getDevice(serialNumber);
        const rediscoveredResolvedDevice =
            client.getResolvedDevice(serialNumber);

        if (!rediscoveredDevice) {
            throw new Error(
                "The target device was not registered after device-online."
            );
        }

        if (!rediscoveredResolvedDevice) {
            throw new Error(
                "The resolved target device was not restored after device-online."
            );
        }

        if (getDiscoveredEventCount() !== 1) {
            throw new Error(
                `Expected exactly one discovery event after the first report, received ${getDiscoveredEventCount()}.`
            );
        }

        if (getStateChangeEventCount() !== 1) {
            throw new Error(
                `Expected exactly one state-change event after the first report, received ${getStateChangeEventCount()}.`
            );
        }

        console.log(
            "Injecting a second report for the already registered device..."
        );

        await testAccess.applyWebSocketReport({
            method: "report",
            devicesn: serialNumber,
            reported: {
                connected: true,
            },
        });

        if (getDiscoveredEventCount() !== 1) {
            throw new Error(
                `A duplicate discovery event was emitted. Total: ${getDiscoveredEventCount()}.`
            );
        }

        if (getStateChangeEventCount() !== 2) {
            throw new Error(
                `Expected two state-change events in total, received ${getStateChangeEventCount()}.`
            );
        }

        console.log("");
        console.log("Runtime discovery test successful.");
        console.log(
            `Registered devices after test: ${client.getDevices().length}`
        );
        console.log(`Discovery events: ${getDiscoveredEventCount()}`);
        console.log(`State-change events: ${getStateChangeEventCount()}`);
    } finally {
        unsubscribeDiscovered?.();
        unsubscribeStateChanged?.();
        client.disconnect();
    }
}

main().catch((error) => {
    console.error("");
    console.error("Runtime discovery test failed:");
    console.error(error);
    process.exit(1);
});
