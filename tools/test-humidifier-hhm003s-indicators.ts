import assert from "node:assert/strict";

import { DreoDevice } from "../packages/dreo-api/src/DreoDevice.js";
import { DreoValidationError } from "../packages/dreo-api/src/errors.js";
import type { Device } from "../packages/dreo-api/src/models/Device.js";
import type { StateConstraint } from "../packages/dreo-api/src/models/StateConstraint.js";
import type { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

const hhm003sDefinition: Device = {
    deviceId: "hhm003s-indicator-test",
    sn: "hhm003s-indicator-test-sn",
    deviceName: "HHM003S indicator test",
    brand: "DREO",
    model: "DR-HHM003S",
    productId: "hhm003s-indicator-test-product",
    productName: "Humidifier",
    owner: true,
    shared: false,
};

const hhm001sDefinition: Device = {
    ...hhm003sDefinition,
    deviceId: "hhm001s-indicator-test",
    sn: "hhm001s-indicator-test-sn",
    deviceName: "HHM001S indicator test",
    model: "DR-HHM001S",
};

class MockWebSocket {
    public readonly commands: Record<string, unknown>[] = [];

    public async sendCommandParams(
        _deviceSn: string,
        params: Record<string, unknown>,
    ): Promise<{
        method: string;
        devicesn: string;
        reported: Record<string, unknown>;
    }> {
        this.commands.push(params);

        return {
            method: "control-reply",
            devicesn: hhm003sDefinition.sn,
            reported: params,
        };
    }
}

async function expectValidationError(
    action: () => Promise<void>,
): Promise<void> {
    let receivedError: unknown;

    try {
        await action();
    } catch (error) {
        receivedError = error;
    }

    assert.ok(
        receivedError instanceof DreoValidationError,
        "Expected DreoValidationError.",
    );
}

async function main(): Promise<void> {
    const websocket = new MockWebSocket();

    /*
     * Keep the shared registry-compatible 0/2 constraints here deliberately.
     * The HHM003S typed setters must provide their confirmed 0/1/2 override
     * without broadening the global semantics of rgblevel or ledlevel.
     */
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
        [
            "hotfogon",
            {
                type: "boolean",
            },
        ],
    ]);

    const device = new DreoDevice(
        hhm003sDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            rgblevel: 2,
            ledlevel: 2,
            hotfogon: false,
        },
    );

    assert.equal(device.state.moodLightLevel, 2);
    assert.equal(device.state.displayLevel, 2);
    assert.equal(device.state.humidifierWarmMist, false);

    await device.setHumidifierWarmMist(true);

    assert.deepEqual(websocket.commands.at(-1), {
        hotfogon: true,
    });
    assert.equal(device.state.humidifierWarmMist, true);

    await device.setHumidifierMoodLightLevel(1);

    assert.deepEqual(websocket.commands.at(-1), {
        rgblevel: 1,
    });
    assert.equal(device.state.moodLightLevel, 1);

    await device.setHumidifierMoodLightLevel(0);

    assert.deepEqual(websocket.commands.at(-1), {
        rgblevel: 0,
    });
    assert.equal(device.state.moodLightLevel, 0);

    await device.setHumidifierDisplayLevel(1);

    assert.deepEqual(websocket.commands.at(-1), {
        ledlevel: 1,
    });
    assert.equal(device.state.displayLevel, 1);

    await device.setHumidifierDisplayLevel(0);

    assert.deepEqual(websocket.commands.at(-1), {
        ledlevel: 0,
    });
    assert.equal(device.state.displayLevel, 0);

    await expectValidationError(async () =>
        device.setHumidifierMoodLightLevel(3),
    );
    await expectValidationError(async () =>
        device.setHumidifierDisplayLevel(-1),
    );

    const poweredOffDevice = new DreoDevice(
        hhm003sDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: false,
            rgblevel: 2,
            ledlevel: 2,
            hotfogon: false,
        },
    );

    const commandCountBeforePoweredOffTests = websocket.commands.length;

    await expectValidationError(async () =>
        poweredOffDevice.setHumidifierMoodLightLevel(1),
    );
    await expectValidationError(async () =>
        poweredOffDevice.setHumidifierDisplayLevel(1),
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforePoweredOffTests,
        "Powered-off HHM003S level writes must not send commands.",
    );

    const hhm001s = new DreoDevice(
        hhm001sDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            rgblevel: 2,
            ledlevel: 2,
            hotfogon: false,
        },
    );

    assert.equal(
        hhm001s.state.humidifierWarmMist,
        undefined,
        "HHM001S must not expose HHM003S warm-mist semantics.",
    );

    await expectValidationError(async () =>
        hhm001s.setHumidifierWarmMist(true),
    );
    await expectValidationError(async () =>
        hhm001s.setHumidifierMoodLightLevel(1),
    );
    await expectValidationError(async () =>
        hhm001s.setHumidifierDisplayLevel(1),
    );

    /*
     * Existing HHM001S switch semantics remain unchanged: true still maps to
     * native level 2 rather than introducing level 1.
     */
    await hhm001s.setMoodLight(true);
    assert.deepEqual(websocket.commands.at(-1), {
        rgblevel: 2,
    });

    await hhm001s.setDisplay(true);
    assert.deepEqual(websocket.commands.at(-1), {
        ledlevel: 2,
    });

    console.log("HHM003S humidifier indicator test successful.");
}

await main();
