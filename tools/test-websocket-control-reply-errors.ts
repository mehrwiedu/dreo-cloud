import assert from "node:assert/strict";

import { DreoWebSocketError } from "../packages/dreo-api/src/errors.js";
import type { DreoSession } from "../packages/dreo-api/src/DreoSession.js";
import { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";
import type { DreoWebSocketReply } from "../packages/dreo-api/src/websocket/DreoWebSocketReply.js";

interface DreoWebSocketClientTestAccess {
    pendingReply?: {
        resolve: (reply: DreoWebSocketReply) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    };

    handleMessage(text: string): void;
}

function createClient(): DreoWebSocketClient {
    return new DreoWebSocketClient({
        session: {} as DreoSession,
    });
}

function getTestAccess(
    client: DreoWebSocketClient
): DreoWebSocketClientTestAccess {
    return client as unknown as DreoWebSocketClientTestAccess;
}

function armPendingReply(
    client: DreoWebSocketClient
): {
    access: DreoWebSocketClientTestAccess;
    promise: Promise<DreoWebSocketReply>;
} {
    const access = getTestAccess(client);

    const promise = new Promise<DreoWebSocketReply>(
        (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(
                    new Error(
                        "Test timed out waiting for control-reply handling."
                    )
                );
            }, 1_000);

            access.pendingReply = {
                resolve,
                reject,
                timeout,
            };
        }
    );

    return {
        access,
        promise,
    };
}

async function captureRejection(
    promise: Promise<unknown>
): Promise<unknown> {
    try {
        await promise;
    } catch (error) {
        return error;
    }

    throw new Error(
        "Expected the control-reply promise to be rejected."
    );
}

async function testSuccessfulControlReply(): Promise<void> {
    const client = createClient();
    const { access, promise } = armPendingReply(client);

    access.handleMessage(
        JSON.stringify({
            method: "control-reply",
            devicesn: "test-device",
            reported: {
                poweron: true,
            },
        })
    );

    const reply = await promise;

    assert.deepEqual(reply.reported, {
        poweron: true,
    });

    assert.equal(
        access.pendingReply,
        undefined,
        "A successful reply must clear the pending command."
    );
}

async function testExplicitZeroErrorCode(): Promise<void> {
    const client = createClient();
    const { access, promise } = armPendingReply(client);

    access.handleMessage(
        JSON.stringify({
            method: "control-reply",
            devicesn: "test-device",
            error_code: 0,
            error_msg: "success",
            reported: {
                fanon: true,
            },
        })
    );

    const reply = await promise;

    assert.equal(reply.error_code, 0);
    assert.deepEqual(reply.reported, {
        fanon: true,
    });

    assert.equal(
        access.pendingReply,
        undefined,
        "Error code zero must still resolve the command."
    );
}

async function testObservedValidationFailure(): Promise<void> {
    const client = createClient();
    const { access, promise } = armPendingReply(client);

    access.handleMessage(
        JSON.stringify({
            method: "control-reply",
            devicesn: "test-device",
            error_code: 500003,
            error_msg: "instruction validate failed",
            reported: {
                predefine: 1,
            },
        })
    );

    const error = await captureRejection(promise);

    assert.ok(
        error instanceof DreoWebSocketError,
        "A failed control-reply must reject with DreoWebSocketError."
    );

    assert.equal(
        error.message,
        "DREO control command failed (code 500003): instruction validate failed."
    );

    assert.equal(
        access.pendingReply,
        undefined,
        "A rejected reply must clear the pending command."
    );
}

async function testStringErrorCode(): Promise<void> {
    const client = createClient();
    const { access, promise } = armPendingReply(client);

    access.handleMessage(
        JSON.stringify({
            method: "control-reply",
            devicesn: "test-device",
            error_code: "500003",
            error_msg: "instruction validate failed",
        })
    );

    const error = await captureRejection(promise);

    assert.ok(error instanceof DreoWebSocketError);

    assert.equal(
        error.message,
        "DREO control command failed (code 500003): instruction validate failed."
    );

    assert.equal(access.pendingReply, undefined);
}

async function testMessageOnlyFailure(): Promise<void> {
    const client = createClient();
    const { access, promise } = armPendingReply(client);

    access.handleMessage(
        JSON.stringify({
            method: "control-reply",
            devicesn: "test-device",
            error_msg: "command rejected",
        })
    );

    const error = await captureRejection(promise);

    assert.ok(error instanceof DreoWebSocketError);

    assert.equal(
        error.message,
        "DREO control command failed: command rejected."
    );

    assert.equal(access.pendingReply, undefined);
}

async function main(): Promise<void> {
    await testSuccessfulControlReply();
    await testExplicitZeroErrorCode();
    await testObservedValidationFailure();
    await testStringErrorCode();
    await testMessageOnlyFailure();

    console.log(
        "WebSocket control-reply error handling test successful."
    );
}

await main();
