import assert from "node:assert/strict";

import { DreoDevice } from "../packages/dreo-api/src/DreoDevice.js";
import { DreoValidationError } from "../packages/dreo-api/src/errors.js";
import type { Device } from "../packages/dreo-api/src/models/Device.js";
import type { StateConstraint } from "../packages/dreo-api/src/models/StateConstraint.js";
import type { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

const deviceDefinition: Device = {
    deviceId: "humidifier-indicator-test",
    sn: "humidifier-indicator-test-sn",
    deviceName: "Humidifier indicator test",
    brand: "DREO",
    model: "DR-HHM001S",
    productId: "humidifier-indicator-test-product",
    productName: "Humidifier",
    owner: true,
    shared: false,
};

class MockWebSocket {
    public readonly commands: Record<string, unknown>[] = [];

    public async sendCommandParams(
        _deviceSn: string,
        params: Record<string, unknown>
    ): Promise<{
        method: string;
        devicesn: string;
        reported: Record<string, unknown>;
    }> {
        this.commands.push(params);

        return {
            method: "control-reply",
            devicesn: deviceDefinition.sn,
            reported: params,
        };
    }
}

async function expectValidationError(
    action: () => Promise<void>
): Promise<void> {
    let receivedError: unknown;

    try {
        await action();
    } catch (error) {
        receivedError = error;
    }

    assert.ok(
        receivedError instanceof DreoValidationError,
        "Expected DreoValidationError."
    );
}

async function main(): Promise<void> {
    const websocket = new MockWebSocket();

    const constraints = new Map<string, StateConstraint>([
        [
            "rgblevel",
            {
                type: "number",
                allowedValues: [0, 2],
            },
        ],
        [
            "ledlevel",
            {
                type: "number",
                allowedValues: [0, 2],
            },
        ],
    ]);

    const device = new DreoDevice(
        deviceDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            rgblevel: 0,
            ledlevel: 2,
        }
    );

    assert.equal(device.state.moodLightLevel, 0);
    assert.equal(device.state.displayLevel, 2);

    await device.setMoodLight(true);

    assert.deepEqual(websocket.commands.at(-1), {
        rgblevel: 2,
    });
    assert.equal(device.state.moodLightLevel, 2);

    await device.setMoodLight(false);

    assert.deepEqual(websocket.commands.at(-1), {
        rgblevel: 0,
    });
    assert.equal(device.state.moodLightLevel, 0);

    await device.setDisplay(false);

    assert.deepEqual(websocket.commands.at(-1), {
        ledlevel: 0,
    });
    assert.equal(device.state.displayLevel, 0);

    await device.setDisplay(true);

    assert.deepEqual(websocket.commands.at(-1), {
        ledlevel: 2,
    });
    assert.equal(device.state.displayLevel, 2);

    /*
     * Reading remains forward-compatible with a possible level 1 report.
     * Typed setters intentionally continue to write only confirmed values
     * 0 and 2.
     */
    device.applyReport({
        rgblevel: 1,
        ledlevel: 1,
    });

    assert.equal(device.state.moodLightLevel, 1);
    assert.equal(device.state.displayLevel, 1);

    const poweredOffDevice = new DreoDevice(
        deviceDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: false,
            rgblevel: 2,
            ledlevel: 2,
        }
    );

    const commandCountBeforePoweredOffTests =
        websocket.commands.length;

    await expectValidationError(
        async () => poweredOffDevice.setMoodLight(false)
    );
    await expectValidationError(
        async () => poweredOffDevice.setDisplay(false)
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforePoweredOffTests,
        "Powered-off indicator writes must not send commands."
    );

    assert.equal(
        poweredOffDevice.state.moodLightLevel,
        2,
        "Power changes must not synthesize a different stored mood-light level."
    );
    assert.equal(
        poweredOffDevice.state.displayLevel,
        2,
        "Power changes must not synthesize a different stored display level."
    );

    const deviceWithoutIndicators = new DreoDevice(
        deviceDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
        }
    );

    await expectValidationError(
        async () => deviceWithoutIndicators.setMoodLight(true)
    );
    await expectValidationError(
        async () => deviceWithoutIndicators.setDisplay(true)
    );

    const deviceWithoutPowerState = new DreoDevice(
        deviceDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            rgblevel: 0,
            ledlevel: 0,
        }
    );

    await expectValidationError(
        async () => deviceWithoutPowerState.setMoodLight(true)
    );
    await expectValidationError(
        async () => deviceWithoutPowerState.setDisplay(true)
    );

    console.log("Humidifier indicator test successful.");
}

await main();
