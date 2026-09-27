import assert from "node:assert/strict";

import { DreoDevice } from "../packages/dreo-api/src/DreoDevice.js";
import { DreoValidationError } from "../packages/dreo-api/src/errors.js";
import type { StateConstraint } from "../packages/dreo-api/src/models/StateConstraint.js";
import type { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

class RecordingWebSocket {
    public readonly commands: Record<string, unknown>[] = [];

    public async sendCommandParams(
        _serialNumber: string,
        params: Record<string, unknown>,
    ): Promise<{ reported: Record<string, unknown> }> {
        this.commands.push({ ...params });

        return {
            reported: { ...params },
        };
    }
}

async function expectValidationError(
    operation: () => Promise<void>,
    description: string,
): Promise<void> {
    try {
        await operation();
    } catch (error) {
        assert.ok(
            error instanceof DreoValidationError,
            `${description}: expected DreoValidationError.`,
        );

        return;
    }

    assert.fail(`${description}: expected the operation to fail.`);
}

async function main(): Promise<void> {
    const webSocket = new RecordingWebSocket();

    const constraints = new Map<string, StateConstraint>([
        [
            "childlockon",
            {
                type: "boolean",
            },
        ],
    ]);

    const device = new DreoDevice(
        {
            sn: "child-lock-test-device",
            model: "DR-HPF002S",
            deviceName: "Child-lock test device",
        } as never,
        webSocket as unknown as DreoWebSocketClient,
        constraints,
        {
            childlockon: false,
        },
    );

    assert.equal(
        device.state.raw.childlockon,
        false,
        "The initial native child-lock state must remain readable.",
    );

    await device.setChildLock(true);

    assert.deepEqual(
        webSocket.commands.at(-1),
        {
            childlockon: true,
        },
        "Enabling the child lock must send only childlockon=true.",
    );

    assert.equal(
        device.state.raw.childlockon,
        true,
        "The confirmed child-lock report must update the SDK raw state.",
    );

    await device.setChildLock(false);

    assert.deepEqual(
        webSocket.commands.at(-1),
        {
            childlockon: false,
        },
        "Disabling the child lock must send only childlockon=false.",
    );

    assert.equal(
        device.state.raw.childlockon,
        false,
        "The confirmed disabled report must update the SDK raw state.",
    );

    const commandCountBeforeSameValueWrite =
        webSocket.commands.length;

    await device.setChildLock(false);

    assert.equal(
        webSocket.commands.length,
        commandCountBeforeSameValueWrite + 1,
        "The SDK must forward an explicitly requested identical value.",
    );

    assert.deepEqual(
        webSocket.commands.at(-1),
        {
            childlockon: false,
        },
        "An identical write must still contain no unrelated states.",
    );

    const commandCountBeforeInvalidWrite =
        webSocket.commands.length;

    await expectValidationError(
        async () => {
            await (
                device.setChildLock as unknown as (
                    value: unknown,
                ) => Promise<void>
            )(1);
        },
        "A numeric child-lock value",
    );

    assert.equal(
        webSocket.commands.length,
        commandCountBeforeInvalidWrite,
        "An invalid child-lock value must not reach the WebSocket.",
    );

    console.log("Native child-lock control test successful.");
}

await main();
