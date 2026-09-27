import assert from "node:assert/strict";

import { DreoDevice } from "../packages/dreo-api/src/DreoDevice.js";
import { DreoValidationError } from "../packages/dreo-api/src/errors.js";
import type { Device } from "../packages/dreo-api/src/models/Device.js";
import type { StateConstraint } from "../packages/dreo-api/src/models/StateConstraint.js";
import type { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

const deviceDefinition: Device = {
    deviceId: "sleep-light-test",
    sn: "sleep-light-test-sn",
    deviceName: "Sleep light test device",
    brand: "DREO",
    model: "DR-HCF007S",
    productId: "sleep-light-test-product",
    productName: "Ceiling Fan",
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
            "scenes",
            {
                type: "string",
            },
        ],
    ]);

    const device = new DreoDevice(
        deviceDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            lighton: true,
            brightness: 29,
            scenes: JSON.stringify({
                mode: 0,
                du: 600,
                minbri: 1,
                maxbri: 29,
            }),
        }
    );

    assert.deepEqual(device.state.scene, {
        mode: 0,
        du: 600,
        minbri: 1,
        maxbri: 29,
    });

    device.applyReport({
        scenes: "{invalid-json",
    });

    assert.deepEqual(
        device.state.scene,
        {
            mode: 0,
            du: 600,
            minbri: 1,
            maxbri: 29,
        },
        "An invalid scene report must preserve the last valid configuration."
    );

    await device.setSleepLight(10);

    assert.deepEqual(websocket.commands.at(-1), {
        scenes: JSON.stringify({
            mode: 3,
            du: 600,
            minbri: 1,
            maxbri: 29,
        }),
    });

    assert.deepEqual(device.state.scene, {
        mode: 3,
        du: 600,
        minbri: 1,
        maxbri: 29,
    });

    await device.disableSleepLight();

    assert.deepEqual(websocket.commands.at(-1), {
        scenes: JSON.stringify({
            mode: 0,
            du: 600,
            minbri: 1,
            maxbri: 29,
        }),
    });

    await expectValidationError(
        async () => device.setSleepLight(9)
    );

    await expectValidationError(
        async () => device.setSleepLight(61)
    );

    await expectValidationError(
        async () => device.setSleepLight(10.5)
    );

    const poweredOffDevice = new DreoDevice(
        deviceDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: false,
            lighton: false,
            brightness: 29,
            scenes: JSON.stringify({
                mode: 0,
                du: 600,
                minbri: 1,
                maxbri: 29,
            }),
        }
    );

    await poweredOffDevice.setSleepLight(10);

    assert.deepEqual(websocket.commands.at(-1), {
        scenes: JSON.stringify({
            mode: 3,
            du: 600,
            minbri: 1,
            maxbri: 29,
        }),
    });

    const deviceWithoutScene = new DreoDevice(
        deviceDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            brightness: 29,
        }
    );

    await expectValidationError(
        async () => deviceWithoutScene.disableSleepLight()
    );

    const deviceWithInvalidBrightness = new DreoDevice(
        deviceDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            brightness: 0,
            scenes: JSON.stringify({
                mode: 0,
                du: 600,
                minbri: 1,
                maxbri: 0,
            }),
        }
    );

    await expectValidationError(
        async () => deviceWithInvalidBrightness.setSleepLight(10)
    );

    const deviceWithoutPowerOn = new DreoDevice(
        deviceDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            lighton: true,
            brightness: 64,
            scenes: JSON.stringify({
                mode: 0,
                du: 600,
                minbri: 1,
                maxbri: 64,
            }),
        }
    );

    await deviceWithoutPowerOn.setSleepLight(60);

    assert.deepEqual(websocket.commands.at(-1), {
        scenes: JSON.stringify({
            mode: 3,
            du: 3600,
            minbri: 1,
            maxbri: 64,
        }),
    });

    console.log("Sleep-light scene test successful.");
}

main().catch((error: unknown) => {
    console.error("Sleep-light scene test failed:");
    console.error(error);
    process.exitCode = 1;
});
