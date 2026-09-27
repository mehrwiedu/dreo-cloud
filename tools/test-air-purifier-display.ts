import assert from "node:assert/strict";

import { DreoDevice } from "../packages/dreo-api/src/DreoDevice.js";
import { DreoValidationError } from "../packages/dreo-api/src/errors.js";
import type { Device } from "../packages/dreo-api/src/models/Device.js";
import type { StateConstraint } from "../packages/dreo-api/src/models/StateConstraint.js";
import type { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

class RecordingWebSocket {
    public readonly commands: Record<string, unknown>[] = [];

    public async sendCommandParams(
        deviceSn: string,
        params: Record<string, unknown>
    ): Promise<{
        method: string;
        devicesn: string;
        reported: Record<string, unknown>;
    }> {
        this.commands.push({ ...params });

        return {
            method: "control-reply",
            devicesn: deviceSn,
            reported: { ...params },
        };
    }
}

function createDeviceDefinition(model: string): Device {
    return {
        deviceId: `${model}-air-purifier-display-test`,
        sn: `${model}-air-purifier-display-test-sn`,
        deviceName: `${model} air-purifier display test`,
        brand: "DREO",
        model,
        productId: `${model}-air-purifier-display-test-product`,
        productName: `${model} air-purifier display test`,
        owner: true,
        shared: false,
    };
}

function createMisleadingConstraint(): ReadonlyMap<
    string,
    StateConstraint
> {
    return new Map([
        [
            "ledalwayson",
            {
                type: "number",
                min: 0,
                max: 1,
                step: 1,
            },
        ],
    ]);
}

async function expectValidationError(
    operation: () => Promise<void>,
    description: string
): Promise<void> {
    let receivedError: unknown;

    try {
        await operation();
    } catch (error) {
        receivedError = error;
    }

    assert.ok(
        receivedError instanceof DreoValidationError,
        `${description}: expected DreoValidationError.`
    );
}

async function main(): Promise<void> {
    const websocket = new RecordingWebSocket();
    const device = new DreoDevice(
        createDeviceDefinition("DR-HAP009S"),
        websocket as unknown as DreoWebSocketClient,
        createMisleadingConstraint(),
        {
            poweron: true,
            mode: "manual",
            windlevel: 2,
            rgbalwayson: true,
            rgblevel: 3,
            ledalwayson: true,
            autoon: false,
        }
    );

    assert.equal(device.state.airPurifierDisplay, true);

    await device.setAirPurifierDisplay(false);

    assert.deepEqual(websocket.commands.at(-1), {
        ledalwayson: false,
    });
    assert.equal(device.state.airPurifierDisplay, false);
    assert.equal(device.state.raw.ledalwayson, false);
    assert.equal(device.state.raw.poweron, true);
    assert.equal(device.state.raw.mode, "manual");
    assert.equal(device.state.raw.windlevel, 2);
    assert.equal(device.state.raw.rgbalwayson, true);
    assert.equal(device.state.raw.rgblevel, 3);
    assert.equal(device.state.raw.autoon, false);

    await device.setAirPurifierDisplay(true);

    assert.deepEqual(websocket.commands.at(-1), {
        ledalwayson: true,
    });
    assert.equal(device.state.airPurifierDisplay, true);
    assert.equal(device.state.raw.ledalwayson, true);

    const commandCountBeforeSameValueWrite =
        websocket.commands.length;

    await device.setAirPurifierDisplay(true);

    assert.equal(
        websocket.commands.length,
        commandCountBeforeSameValueWrite + 1
    );
    assert.deepEqual(websocket.commands.at(-1), {
        ledalwayson: true,
    });

    const commandCountBeforeInvalidValue =
        websocket.commands.length;

    await expectValidationError(
        async () => {
            await (
                device.setAirPurifierDisplay as unknown as (
                    enabled: unknown
                ) => Promise<void>
            )(1);
        },
        "Invalid air-purifier display value"
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidValue,
        "An invalid display value must not reach the WebSocket."
    );

    device.applyReport({
        ledalwayson: "unexpected",
    });

    assert.equal(
        device.state.airPurifierDisplay,
        true,
        "An unknown report must not replace the confirmed semantic state."
    );
    assert.equal(device.state.raw.ledalwayson, "unexpected");

    await device.setAirPurifierDisplay(false);

    assert.deepEqual(websocket.commands.at(-1), {
        ledalwayson: false,
    });
    assert.equal(device.state.airPurifierDisplay, false);

    const unsupportedWebSocket = new RecordingWebSocket();
    const unsupportedDevice = new DreoDevice(
        createDeviceDefinition("DR-HHM001S"),
        unsupportedWebSocket as unknown as DreoWebSocketClient,
        createMisleadingConstraint(),
        {
            poweron: true,
            ledalwayson: true,
        }
    );

    assert.equal(
        unsupportedDevice.state.airPurifierDisplay,
        undefined
    );

    await expectValidationError(
        async () => unsupportedDevice.setAirPurifierDisplay(false),
        "Unsupported model"
    );

    const missingStateWebSocket = new RecordingWebSocket();
    const missingStateDevice = new DreoDevice(
        createDeviceDefinition("DR-HAP009S"),
        missingStateWebSocket as unknown as DreoWebSocketClient,
        createMisleadingConstraint(),
        {
            poweron: true,
            mode: "manual",
        }
    );

    await expectValidationError(
        async () => missingStateDevice.setAirPurifierDisplay(true),
        "Missing native ledalwayson state"
    );

    assert.equal(unsupportedWebSocket.commands.length, 0);
    assert.equal(missingStateWebSocket.commands.length, 0);

    console.log("Air-purifier display test successful.");
}

main().catch((error: unknown) => {
    console.error("Air-purifier display test failed:");
    console.error(error);
    process.exitCode = 1;
});
