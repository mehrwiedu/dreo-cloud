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
        deviceId: `${model}-air-purifier-wind-level-test`,
        sn: `${model}-air-purifier-wind-level-test-sn`,
        deviceName: `${model} air-purifier wind-level test`,
        brand: "DREO",
        model,
        productId: `${model}-air-purifier-wind-level-test-product`,
        productName: `${model} air-purifier wind-level test`,
        owner: true,
        shared: false,
    };
}

function createGenericWindLevelConstraint(): ReadonlyMap<
    string,
    StateConstraint
> {
    return new Map([
        [
            "windlevel",
            {
                type: "number",
                min: 1,
                max: 12,
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
        createGenericWindLevelConstraint(),
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

    for (const level of [1, 2, 3]) {
        await device.setAirPurifierWindLevel(level);

        assert.deepEqual(websocket.commands.at(-1), {
            windlevel: level,
        });
        assert.equal(device.state.windLevel, level);
        assert.equal(device.state.raw.windlevel, level);
        assert.equal(device.state.raw.poweron, true);
        assert.equal(device.state.raw.mode, "manual");
        assert.equal(device.state.airPurifierMode, "manual");
        assert.equal(device.state.raw.rgbalwayson, true);
        assert.equal(device.state.raw.rgblevel, 3);
        assert.equal(device.state.raw.ledalwayson, true);
        assert.equal(device.state.raw.autoon, false);
        assert.equal(
            Object.prototype.hasOwnProperty.call(
                device.state.raw,
                "fanon"
            ),
            false,
            "Air-purifier speed writes must not synthesize fanon."
        );
    }

    const commandCountBeforeSameValueWrite = websocket.commands.length;

    await device.setAirPurifierWindLevel(3);

    assert.equal(
        websocket.commands.length,
        commandCountBeforeSameValueWrite + 1
    );
    assert.deepEqual(websocket.commands.at(-1), {
        windlevel: 3,
    });

    const commandCountBeforeInvalidLevels = websocket.commands.length;

    for (const value of [0, 4, 1.5, Number.NaN]) {
        await expectValidationError(
            async () => device.setAirPurifierWindLevel(value),
            `Invalid air-purifier wind level ${String(value)}`
        );
    }

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidLevels,
        "Invalid levels must not reach the WebSocket."
    );

    device.applyReport({
        mode: "sleep",
    });

    await expectValidationError(
        async () => device.setAirPurifierWindLevel(2),
        "Non-manual air-purifier mode"
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidLevels,
        "A non-manual mode must reject speed writes before the WebSocket."
    );

    device.applyReport({
        mode: "manual",
    });

    assert.equal(device.state.airPurifierMode, "manual");

    device.applyReport({
        mode: "unexpected",
    });

    assert.equal(
        device.state.airPurifierMode,
        "manual",
        "The semantic mode may retain the last confirmed value."
    );
    assert.equal(device.state.raw.mode, "unexpected");

    await expectValidationError(
        async () => device.setAirPurifierWindLevel(2),
        "Unknown current RAW air-purifier mode"
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidLevels,
        "An unknown current RAW mode must reject speed writes."
    );

    const unsupportedWebSocket = new RecordingWebSocket();
    const unsupportedDevice = new DreoDevice(
        createDeviceDefinition("DR-HPF002S"),
        unsupportedWebSocket as unknown as DreoWebSocketClient,
        createGenericWindLevelConstraint(),
        {
            poweron: true,
            windlevel: 1,
        }
    );

    await expectValidationError(
        async () => unsupportedDevice.setAirPurifierWindLevel(2),
        "Unsupported model"
    );

    const missingStateWebSocket = new RecordingWebSocket();
    const missingStateDevice = new DreoDevice(
        createDeviceDefinition("DR-HAP009S"),
        missingStateWebSocket as unknown as DreoWebSocketClient,
        createGenericWindLevelConstraint(),
        {
            poweron: true,
            mode: "manual",
        }
    );

    await expectValidationError(
        async () => missingStateDevice.setAirPurifierWindLevel(2),
        "Missing native windlevel state"
    );

    assert.equal(unsupportedWebSocket.commands.length, 0);
    assert.equal(missingStateWebSocket.commands.length, 0);

    console.log("Air-purifier wind-level test successful.");
}

main().catch((error: unknown) => {
    console.error("Air-purifier wind-level test failed:");
    console.error(error);
    process.exitCode = 1;
});
