import assert from "node:assert/strict";

import { DreoDevice } from "../packages/dreo-api/src/DreoDevice.js";
import { DreoValidationError } from "../packages/dreo-api/src/errors.js";
import type { Device } from "../packages/dreo-api/src/models/Device.js";
import {
    DreoDirectionalOscillationMode,
} from "../packages/dreo-api/src/models/DreoDirectionalOscillationMode.js";
import type { StateConstraint } from "../packages/dreo-api/src/models/StateConstraint.js";
import type { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

const standFanDefinition: Device = {
    deviceId: "directional-oscillation-test",
    sn: "directional-oscillation-test-sn",
    deviceName: "Directional oscillation test",
    brand: "DREO",
    model: "DR-HPF002S",
    productId: "directional-oscillation-test-product",
    productName: "Stand fan",
    owner: true,
    shared: false,
};

class MockWebSocket {
    public readonly commands: Record<string, unknown>[] = [];

    public async sendCommandParams(
        deviceSn: string,
        params: Record<string, unknown>
    ): Promise<{
        method: string;
        devicesn: string;
        reported: Record<string, unknown>;
    }> {
        this.commands.push(params);

        return {
            method: "control-reply",
            devicesn: deviceSn,
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
            "oscmode",
            {
                type: "number",
                step: 1,
            },
        ],
    ]);

    const standFan = new DreoDevice(
        standFanDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            fanon: true,
            oscmode: DreoDirectionalOscillationMode.Horizontal,
        }
    );

    assert.equal(
        standFan.state.directionalOscillationMode,
        DreoDirectionalOscillationMode.Horizontal
    );

    for (const mode of [
        DreoDirectionalOscillationMode.Off,
        DreoDirectionalOscillationMode.Horizontal,
        DreoDirectionalOscillationMode.Vertical,
        DreoDirectionalOscillationMode.Both,
    ]) {
        await standFan.setDirectionalOscillationMode(mode);

        assert.deepEqual(websocket.commands.at(-1), {
            oscmode: mode,
        });

        assert.equal(
            standFan.state.directionalOscillationMode,
            mode
        );

        assert.equal(
            standFan.state.power,
            true,
            "Oscillation writes must not synthesize a power change."
        );

        assert.equal(
            standFan.state.fan,
            true,
            "Oscillation writes must not synthesize a fan change."
        );
    }

    const commandCountBeforeInvalidValues =
        websocket.commands.length;

    await expectValidationError(
        async () => standFan.setDirectionalOscillationMode(-1)
    );

    await expectValidationError(
        async () => standFan.setDirectionalOscillationMode(4)
    );

    await expectValidationError(
        async () => standFan.setDirectionalOscillationMode(1.5)
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidValues,
        "Invalid oscillation modes must not send commands."
    );

    standFan.applyReport({
        oscmode: 2.5,
    });

    assert.equal(
        standFan.state.directionalOscillationMode,
        DreoDirectionalOscillationMode.Both,
        "An invalid report must preserve the last valid directional mode."
    );

    const standFanWithoutOscillationState = new DreoDevice(
        {
            ...standFanDefinition,
            sn: "directional-oscillation-without-state",
        },
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            fanon: true,
        }
    );

    assert.equal(
        standFanWithoutOscillationState.state
            .directionalOscillationMode,
        undefined
    );

    await expectValidationError(
        async () =>
            standFanWithoutOscillationState
                .setDirectionalOscillationMode(
                    DreoDirectionalOscillationMode.Horizontal
                )
    );

    const heaterUsingSameRawKey = new DreoDevice(
        {
            ...standFanDefinition,
            sn: "directional-oscillation-heater",
            model: "DR-HSH034S",
            productName: "Heater",
        },
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            oscmode: 4,
        }
    );

    assert.equal(
        heaterUsingSameRawKey.state.directionalOscillationMode,
        undefined,
        "A different oscmode semantic must not be exposed as directional oscillation."
    );

    await expectValidationError(
        async () =>
            heaterUsingSameRawKey.setDirectionalOscillationMode(
                DreoDirectionalOscillationMode.Horizontal
            )
    );

    console.log(
        "Directional oscillation mode test successful."
    );
}

await main();
