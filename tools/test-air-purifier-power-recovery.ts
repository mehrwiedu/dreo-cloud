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
        deviceId: `${model}-power-recovery-test`,
        sn: `${model}-power-recovery-test-sn`,
        deviceName: `${model} power recovery test`,
        brand: "DREO",
        model,
        productId: `${model}-power-recovery-test-product`,
        productName: `${model} power recovery test`,
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
            "autoon",
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
            autoon: true,
        }
    );

    assert.equal(
        device.state.airPurifierPowerRecovery,
        true
    );

    await device.setAirPurifierPowerRecovery(false);

    assert.deepEqual(websocket.commands.at(-1), {
        autoon: false,
    });
    assert.equal(
        device.state.airPurifierPowerRecovery,
        false
    );
    assert.equal(device.state.raw.autoon, false);
    assert.equal(device.state.raw.poweron, true);
    assert.equal(device.state.raw.mode, "manual");
    assert.equal(device.state.raw.windlevel, 2);
    assert.equal(device.state.raw.rgbalwayson, true);
    assert.equal(device.state.raw.rgblevel, 3);
    assert.equal(device.state.raw.ledalwayson, true);

    await device.setAirPurifierPowerRecovery(true);

    assert.deepEqual(websocket.commands.at(-1), {
        autoon: true,
    });
    assert.equal(
        device.state.airPurifierPowerRecovery,
        true
    );
    assert.equal(device.state.raw.autoon, true);

    const commandCountBeforeSameValueWrite =
        websocket.commands.length;

    await device.setAirPurifierPowerRecovery(true);

    assert.equal(
        websocket.commands.length,
        commandCountBeforeSameValueWrite + 1
    );
    assert.deepEqual(websocket.commands.at(-1), {
        autoon: true,
    });

    const commandCountBeforeInvalidValue =
        websocket.commands.length;

    await expectValidationError(
        async () => {
            await (
                device.setAirPurifierPowerRecovery as unknown as (
                    enabled: unknown
                ) => Promise<void>
            )(1);
        },
        "Invalid air-purifier power-recovery value"
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidValue,
        "An invalid value must not reach the WebSocket."
    );

    device.applyReport({
        autoon: "unexpected",
    });

    assert.equal(
        device.state.airPurifierPowerRecovery,
        true,
        "An unknown report must not replace the confirmed semantic state."
    );
    assert.equal(device.state.raw.autoon, "unexpected");

    await device.setAirPurifierPowerRecovery(false);

    assert.deepEqual(websocket.commands.at(-1), {
        autoon: false,
    });
    assert.equal(
        device.state.airPurifierPowerRecovery,
        false
    );

    const unsupportedWebSocket = new RecordingWebSocket();
    const unsupportedDevice = new DreoDevice(
        createDeviceDefinition("DR-HHM001S"),
        unsupportedWebSocket as unknown as DreoWebSocketClient,
        createMisleadingConstraint(),
        {
            poweron: true,
            autoon: true,
        }
    );

    assert.equal(
        unsupportedDevice.state.airPurifierPowerRecovery,
        undefined
    );

    await expectValidationError(
        async () =>
            unsupportedDevice.setAirPurifierPowerRecovery(false),
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
        async () =>
            missingStateDevice.setAirPurifierPowerRecovery(true),
        "Missing native autoon state"
    );

    assert.equal(unsupportedWebSocket.commands.length, 0);
    assert.equal(missingStateWebSocket.commands.length, 0);

    console.log(
        "Air-purifier power-recovery test successful."
    );
}

main().catch((error: unknown) => {
    console.error(
        "Air-purifier power-recovery test failed:"
    );
    console.error(error);
    process.exitCode = 1;
});
