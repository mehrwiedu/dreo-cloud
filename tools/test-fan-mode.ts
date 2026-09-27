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

function createDeviceDefinition(
    model: string,
    name: string
): Device {
    return {
        deviceId: `${model}-fan-mode-test`,
        sn: `${model}-fan-mode-test-sn`,
        deviceName: name,
        brand: "DREO",
        model,
        productId: `${model}-fan-mode-test-product`,
        productName: name,
        owner: true,
        shared: false,
    };
}

function createModeConstraint(
    allowedValues: number[]
): ReadonlyMap<string, StateConstraint> {
    return new Map([
        [
            "mode",
            {
                type: "number",
                step: 1,
                allowedValues,
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

async function testSupportedFan(
    model: string,
    supportedModes: number[],
    initialRawState: Record<string, unknown>
): Promise<void> {
    const websocket = new RecordingWebSocket();
    const device = new DreoDevice(
        createDeviceDefinition(model, `${model} test fan`),
        websocket as unknown as DreoWebSocketClient,
        createModeConstraint(supportedModes),
        initialRawState
    );

    const initialPower = device.state.raw.poweron;
    const initialFan = device.state.raw.fanon;
    const initialWindLevel = device.state.raw.windlevel;

    for (const mode of supportedModes) {
        await device.setFanMode(mode);

        assert.deepEqual(
            websocket.commands.at(-1),
            {
                mode,
            },
            `${model} mode ${mode} must send only the native mode state.`
        );

        assert.equal(
            device.state.mode,
            mode,
            `${model} mode ${mode} must update the confirmed SDK state.`
        );

        assert.equal(
            device.state.raw.poweron,
            initialPower,
            `${model} mode writes must not synthesize poweron.`
        );

        assert.equal(
            device.state.raw.fanon,
            initialFan,
            `${model} mode writes must not synthesize fanon.`
        );

        assert.equal(
            device.state.raw.windlevel,
            initialWindLevel,
            `${model} mode writes must not synthesize windlevel.`
        );
    }

    const commandCountBeforeSameValueWrite =
        websocket.commands.length;
    const lastMode = supportedModes.at(-1);

    assert.notEqual(lastMode, undefined);

    await device.setFanMode(lastMode);

    assert.equal(
        websocket.commands.length,
        commandCountBeforeSameValueWrite + 1,
        `${model} must forward an explicitly requested identical mode.`
    );

    assert.deepEqual(websocket.commands.at(-1), {
        mode: lastMode,
    });
}

async function main(): Promise<void> {
    await testSupportedFan(
        "DR-HCF007S",
        [1, 2, 3, 4],
        {
            poweron: true,
            fanon: true,
            windlevel: 3,
            mode: 1,
        }
    );

    await testSupportedFan(
        "DR-HCF001S",
        [1, 2, 3, 4],
        {
            fanon: true,
            windlevel: 2,
            mode: 1,
        }
    );

    await testSupportedFan(
        "DR-HPF002S",
        [1, 2, 3, 4, 5, 6],
        {
            poweron: true,
            fanon: true,
            windlevel: 3,
            mode: 1,
        }
    );

    const ceilingFanWebSocket = new RecordingWebSocket();
    const ceilingFan = new DreoDevice(
        createDeviceDefinition(
            "DR-HCF007S",
            "Ceiling fan validation test"
        ),
        ceilingFanWebSocket as unknown as DreoWebSocketClient,
        createModeConstraint([1, 2, 3, 4]),
        {
            poweron: true,
            fanon: true,
            windlevel: 3,
            mode: 1,
        }
    );

    const commandCountBeforeInvalidCeilingModes =
        ceilingFanWebSocket.commands.length;

    await expectValidationError(
        async () => ceilingFan.setFanMode(0),
        "Ceiling-fan mode zero"
    );

    await expectValidationError(
        async () => ceilingFan.setFanMode(5),
        "Ceiling-fan mode five"
    );

    await expectValidationError(
        async () => ceilingFan.setFanMode(1.5),
        "Fractional ceiling-fan mode"
    );

    await expectValidationError(
        async () => {
            await (
                ceilingFan.setFanMode as unknown as (
                    value: unknown
                ) => Promise<void>
            )("normal");
        },
        "String ceiling-fan mode"
    );

    assert.equal(
        ceilingFanWebSocket.commands.length,
        commandCountBeforeInvalidCeilingModes,
        "Invalid ceiling-fan modes must not reach the WebSocket."
    );

    const standFanWebSocket = new RecordingWebSocket();
    const standFan = new DreoDevice(
        createDeviceDefinition(
            "DR-HPF002S",
            "Stand fan validation test"
        ),
        standFanWebSocket as unknown as DreoWebSocketClient,
        createModeConstraint([1, 2, 3, 4, 5, 6]),
        {
            poweron: true,
            fanon: true,
            windlevel: 3,
            mode: 1,
        }
    );

    await expectValidationError(
        async () => standFan.setFanMode(7),
        "Stand-fan mode seven"
    );

    assert.equal(
        standFanWebSocket.commands.length,
        0,
        "An invalid stand-fan mode must not reach the WebSocket."
    );

    const unsupportedWebSocket = new RecordingWebSocket();
    const unsupportedDevice = new DreoDevice(
        createDeviceDefinition(
            "DR-HSH034S",
            "Unsupported heater"
        ),
        unsupportedWebSocket as unknown as DreoWebSocketClient,
        createModeConstraint([1, 2, 3, 4]),
        {
            poweron: true,
            mode: 1,
        }
    );

    await expectValidationError(
        async () => unsupportedDevice.setFanMode(1),
        "A different device category using the same raw mode key"
    );

    assert.equal(
        unsupportedWebSocket.commands.length,
        0,
        "An unsupported model must not receive a fan-mode command."
    );

    const missingModeWebSocket = new RecordingWebSocket();
    const fanWithoutModeState = new DreoDevice(
        createDeviceDefinition(
            "DR-HPF002S",
            "Stand fan without mode"
        ),
        missingModeWebSocket as unknown as DreoWebSocketClient,
        createModeConstraint([1, 2, 3, 4, 5, 6]),
        {
            poweron: true,
            fanon: true,
            windlevel: 3,
        }
    );

    await expectValidationError(
        async () => fanWithoutModeState.setFanMode(1),
        "A supported fan without the native mode state"
    );

    assert.equal(
        missingModeWebSocket.commands.length,
        0,
        "A fan without the native mode state must not receive a command."
    );

    console.log("Native fan-mode control test successful.");
}

await main();
