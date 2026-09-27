import assert from "node:assert/strict";

import { DreoDevice } from "../packages/dreo-api/src/DreoDevice.js";
import { DREO_AIR_PURIFIER_MODES } from "../packages/dreo-api/src/models/DreoAirPurifierMode.js";
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
        deviceId: `${model}-air-purifier-mode-test`,
        sn: `${model}-air-purifier-mode-test-sn`,
        deviceName: `${model} air-purifier mode test`,
        brand: "DREO",
        model,
        productId: `${model}-air-purifier-mode-test-product`,
        productName: `${model} air-purifier mode test`,
        owner: true,
        shared: false,
    };
}

function createMisleadingModeConstraint(): ReadonlyMap<
    string,
    StateConstraint
> {
    return new Map([
        [
            "mode",
            {
                type: "number",
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
    const initialRawState = {
        poweron: true,
        mode: "manual",
        windlevel: 1,
        rgbalwayson: true,
        rgblevel: 3,
        ledalwayson: true,
        autoon: false,
    };
    const device = new DreoDevice(
        createDeviceDefinition("DR-HAP009S"),
        websocket as unknown as DreoWebSocketClient,
        createMisleadingModeConstraint(),
        initialRawState
    );

    assert.equal(device.state.airPurifierMode, "manual");
    assert.equal(device.state.mode, undefined);

    for (const mode of DREO_AIR_PURIFIER_MODES) {
        await device.setAirPurifierMode(mode);

        assert.deepEqual(websocket.commands.at(-1), { mode });
        assert.equal(device.state.airPurifierMode, mode);
        assert.equal(device.state.raw.mode, mode);
        assert.equal(device.state.raw.poweron, true);
        assert.equal(device.state.raw.windlevel, 1);
        assert.equal(device.state.raw.rgbalwayson, true);
        assert.equal(device.state.raw.rgblevel, 3);
        assert.equal(device.state.raw.ledalwayson, true);
        assert.equal(device.state.raw.autoon, false);
    }

    const commandCountBeforeSameValueWrite = websocket.commands.length;

    await device.setAirPurifierMode("sleep");

    assert.equal(
        websocket.commands.length,
        commandCountBeforeSameValueWrite + 1
    );
    assert.deepEqual(websocket.commands.at(-1), { mode: "sleep" });

    const commandCountBeforeInvalidModes = websocket.commands.length;

    for (const value of ["auto", "", 0, null]) {
        await expectValidationError(
            async () => {
                await (
                    device.setAirPurifierMode as unknown as (
                        mode: unknown
                    ) => Promise<void>
                )(value);
            },
            `Invalid air-purifier mode ${String(value)}`
        );
    }

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidModes,
        "Invalid modes must not reach the WebSocket."
    );

    device.applyReport({
        mode: "unexpected",
    });

    assert.equal(
        device.state.airPurifierMode,
        "sleep",
        "An unknown reported string must not replace the confirmed semantic mode."
    );
    assert.equal(
        device.state.raw.mode,
        "unexpected",
        "RAW state must preserve the original reported value."
    );

    const unsupportedWebSocket = new RecordingWebSocket();
    const unsupportedDevice = new DreoDevice(
        createDeviceDefinition("DR-HHM001S"),
        unsupportedWebSocket as unknown as DreoWebSocketClient,
        createMisleadingModeConstraint(),
        {
            mode: "manual",
        }
    );

    assert.equal(unsupportedDevice.state.airPurifierMode, undefined);

    await expectValidationError(
        async () => unsupportedDevice.setAirPurifierMode("manual"),
        "Unsupported model"
    );

    const missingStateWebSocket = new RecordingWebSocket();
    const missingStateDevice = new DreoDevice(
        createDeviceDefinition("DR-HAP009S"),
        missingStateWebSocket as unknown as DreoWebSocketClient,
        createMisleadingModeConstraint(),
        {
            poweron: true,
        }
    );

    await expectValidationError(
        async () => missingStateDevice.setAirPurifierMode("manual"),
        "Missing native mode state"
    );

    assert.equal(unsupportedWebSocket.commands.length, 0);
    assert.equal(missingStateWebSocket.commands.length, 0);

    console.log("Air-purifier mode test successful.");
}

main().catch((error: unknown) => {
    console.error("Air-purifier mode test failed:");
    console.error(error);
    process.exitCode = 1;
});
