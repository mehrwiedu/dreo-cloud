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
        deviceId: `${model}-air-purifier-mood-light-test`,
        sn: `${model}-air-purifier-mood-light-test-sn`,
        deviceName: `${model} air-purifier mood-light test`,
        brand: "DREO",
        model,
        productId: `${model}-air-purifier-mood-light-test-product`,
        productName: `${model} air-purifier mood-light test`,
        owner: true,
        shared: false,
    };
}

function createMisleadingConstraints(): ReadonlyMap<
    string,
    StateConstraint
> {
    return new Map([
        [
            "rgbalwayson",
            {
                type: "number",
                min: 0,
                max: 1,
                step: 1,
            },
        ],
        [
            "rgblevel",
            {
                type: "number",
                allowedValues: [0, 2],
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
        createMisleadingConstraints(),
        {
            poweron: true,
            mode: "manual",
            windlevel: 1,
            rgbalwayson: true,
            rgblevel: 3,
            ledalwayson: true,
            autoon: false,
        }
    );

    assert.equal(device.state.airPurifierMoodLight, true);
    assert.equal(device.state.airPurifierMoodLightLevel, 3);

    await device.setAirPurifierMoodLight(false);

    assert.deepEqual(websocket.commands.at(-1), {
        rgbalwayson: false,
    });
    assert.equal(device.state.airPurifierMoodLight, false);
    assert.equal(device.state.airPurifierMoodLightLevel, 3);
    assert.equal(device.state.raw.rgblevel, 3);

    await device.setAirPurifierMoodLight(true);

    assert.deepEqual(websocket.commands.at(-1), {
        rgbalwayson: true,
    });
    assert.equal(device.state.airPurifierMoodLight, true);
    assert.equal(device.state.airPurifierMoodLightLevel, 3);

    for (const level of [1, 2, 3]) {
        await device.setAirPurifierMoodLightLevel(level);

        assert.deepEqual(websocket.commands.at(-1), {
            rgblevel: level,
        });
        assert.equal(device.state.airPurifierMoodLight, true);
        assert.equal(device.state.airPurifierMoodLightLevel, level);
        assert.equal(device.state.raw.rgblevel, level);
        assert.equal(device.state.raw.rgbalwayson, true);
        assert.equal(device.state.raw.poweron, true);
        assert.equal(device.state.raw.mode, "manual");
        assert.equal(device.state.raw.windlevel, 1);
        assert.equal(device.state.raw.ledalwayson, true);
        assert.equal(device.state.raw.autoon, false);
    }

    await device.setAirPurifierMoodLight(false);
    await device.setAirPurifierMoodLightLevel(2);

    assert.deepEqual(websocket.commands.at(-1), {
        rgbalwayson: true,
        rgblevel: 2,
    });
    assert.equal(device.state.airPurifierMoodLight, true);
    assert.equal(device.state.airPurifierMoodLightLevel, 2);

    const commandCountBeforeInvalidValues = websocket.commands.length;

    for (const value of [0, 4, 1.5, Number.NaN]) {
        await expectValidationError(
            async () => device.setAirPurifierMoodLightLevel(value),
            `Invalid air-purifier mood-light level ${String(value)}`
        );
    }

    await expectValidationError(
        async () => {
            await (
                device.setAirPurifierMoodLight as unknown as (
                    enabled: unknown
                ) => Promise<void>
            )(1);
        },
        "Invalid air-purifier mood-light switch value"
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidValues,
        "Invalid mood-light values must not reach the WebSocket."
    );

    device.applyReport({
        rgblevel: 4,
    });

    assert.equal(
        device.state.airPurifierMoodLightLevel,
        2,
        "An unknown reported level must not replace the confirmed semantic level."
    );
    assert.equal(device.state.raw.rgblevel, 4);

    device.applyReport({
        rgbalwayson: "unexpected",
    });

    assert.equal(
        device.state.airPurifierMoodLight,
        true,
        "An unknown reported switch value must not replace the confirmed semantic state."
    );
    assert.equal(device.state.raw.rgbalwayson, "unexpected");

    await expectValidationError(
        async () => device.setAirPurifierMoodLightLevel(1),
        "Unknown current RAW mood-light state"
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidValues,
        "An unknown current RAW switch state must reject level writes."
    );

    await device.setAirPurifierMoodLight(false);

    assert.deepEqual(websocket.commands.at(-1), {
        rgbalwayson: false,
    });

    const unsupportedWebSocket = new RecordingWebSocket();
    const unsupportedDevice = new DreoDevice(
        createDeviceDefinition("DR-HHM001S"),
        unsupportedWebSocket as unknown as DreoWebSocketClient,
        createMisleadingConstraints(),
        {
            poweron: true,
            rgbalwayson: true,
            rgblevel: 2,
        }
    );

    assert.equal(unsupportedDevice.state.airPurifierMoodLight, undefined);
    assert.equal(
        unsupportedDevice.state.airPurifierMoodLightLevel,
        undefined
    );

    await expectValidationError(
        async () => unsupportedDevice.setAirPurifierMoodLight(false),
        "Unsupported model mood-light switch"
    );
    await expectValidationError(
        async () => unsupportedDevice.setAirPurifierMoodLightLevel(2),
        "Unsupported model mood-light level"
    );

    const missingStateWebSocket = new RecordingWebSocket();
    const missingStateDevice = new DreoDevice(
        createDeviceDefinition("DR-HAP009S"),
        missingStateWebSocket as unknown as DreoWebSocketClient,
        createMisleadingConstraints(),
        {
            poweron: true,
            mode: "manual",
        }
    );

    await expectValidationError(
        async () => missingStateDevice.setAirPurifierMoodLight(true),
        "Missing native rgbalwayson state"
    );
    await expectValidationError(
        async () => missingStateDevice.setAirPurifierMoodLightLevel(2),
        "Missing native mood-light states"
    );

    assert.equal(unsupportedWebSocket.commands.length, 0);
    assert.equal(missingStateWebSocket.commands.length, 0);

    console.log("Air-purifier mood-light test successful.");
}

main().catch((error: unknown) => {
    console.error("Air-purifier mood-light test failed:");
    console.error(error);
    process.exitCode = 1;
});
