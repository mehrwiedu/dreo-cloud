import assert from "node:assert/strict";

import { DreoDevice } from "../packages/dreo-api/src/DreoDevice.js";
import { DreoValidationError } from "../packages/dreo-api/src/errors.js";
import type { Device } from "../packages/dreo-api/src/models/Device.js";
import type { StateConstraint } from "../packages/dreo-api/src/models/StateConstraint.js";
import type { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

const deviceDefinition: Device = {
    deviceId: "power-timer-test",
    sn: "power-timer-test-sn",
    deviceName: "Power timer test device",
    brand: "DREO",
    model: "DR-HCF007S",
    productId: "power-timer-test-product",
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

function readTimerCommand(
    websocket: MockWebSocket,
    timerKey: "timeron" | "timeroff"
): { du: number; ts: number } {
    const command = websocket.commands.at(-1);

    assert.ok(command, "Expected a WebSocket command.");

    const value = command[timerKey];

    assert.ok(
        typeof value === "object" &&
            value !== null &&
            !Array.isArray(value),
        `Expected ${timerKey} command object.`
    );

    const timer = value as Record<string, unknown>;

    assert.equal(typeof timer.du, "number");
    assert.equal(typeof timer.ts, "number");
    assert.ok(Number.isInteger(timer.du));
    assert.ok(Number.isInteger(timer.ts));
    assert.ok((timer.ts as number) > 0);

    return {
        du: timer.du as number,
        ts: timer.ts as number,
    };
}

async function main(): Promise<void> {
    const websocket = new MockWebSocket();

    const constraints = new Map<string, StateConstraint>([
        ["timeron", { type: "object" }],
        ["timeroff", { type: "object" }],
    ]);

    const poweredDevice = new DreoDevice(
        deviceDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: false,
            fanon: true,
            lighton: true,
            atmon: true,
            timeron: {
                du: 0,
                ts: 100,
            },
            timeroff: {
                du: 0,
                ts: 100,
            },
        }
    );

    assert.deepEqual(poweredDevice.state.powerOnTimer, {
        du: 0,
        ts: 100,
    });

    assert.deepEqual(poweredDevice.state.powerOffTimer, {
        du: 0,
        ts: 100,
    });

    const beforePowerOnTimer = Math.floor(Date.now() / 1000);

    await poweredDevice.setPowerOnTimer(1);

    const powerOnTimer = readTimerCommand(websocket, "timeron");

    assert.equal(powerOnTimer.du, 1);
    assert.ok(powerOnTimer.ts >= beforePowerOnTimer);
    assert.ok(powerOnTimer.ts <= Math.floor(Date.now() / 1000));

    assert.equal(
        poweredDevice.state.power,
        false,
        "A timer command must not alter the current power state."
    );

    await expectValidationError(
        async () => poweredDevice.setPowerOffTimer(1)
    );

    await expectValidationError(
        async () => poweredDevice.setPowerOnTimer(0)
    );

    await expectValidationError(
        async () => poweredDevice.setPowerOnTimer(720)
    );

    await expectValidationError(
        async () => poweredDevice.setPowerOnTimer(1.5)
    );

    poweredDevice.applyReport({
        poweron: true,
    });

    await expectValidationError(
        async () => poweredDevice.setPowerOnTimer(1)
    );

    await poweredDevice.setPowerOffTimer(719);

    assert.equal(readTimerCommand(websocket, "timeroff").du, 719);

    await poweredDevice.cancelPowerOffTimer();

    assert.equal(readTimerCommand(websocket, "timeroff").du, 0);

    assert.equal(
        poweredDevice.state.power,
        true,
        "Cancelling a timer must not alter the current power state."
    );

    await poweredDevice.cancelPowerOnTimer();

    assert.equal(readTimerCommand(websocket, "timeron").du, 0);

    const poweredDeviceWithoutActiveComponents = new DreoDevice(
        {
            ...deviceDefinition,
            sn: "power-timer-test-inactive-components",
        },
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            fanon: false,
            lighton: false,
            atmon: false,
            timeron: {
                du: 0,
                ts: 150,
            },
            timeroff: {
                du: 0,
                ts: 150,
            },
        }
    );

    await expectValidationError(
        async () =>
            poweredDeviceWithoutActiveComponents.setPowerOffTimer(10)
    );

    const humidifier = new DreoDevice(
        {
            ...deviceDefinition,
            sn: "power-timer-test-humidifier",
            model: "DR-HHM001S",
            productName: "Humidifier",
        },
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            rgblevel: 0,
            timeron: {
                du: 0,
                ts: 175,
            },
            timeroff: {
                du: 0,
                ts: 175,
            },
        }
    );

    await humidifier.setPowerOffTimer(5);

    assert.equal(readTimerCommand(websocket, "timeroff").du, 5);
    assert.equal(
        humidifier.state.raw.rgblevel,
        0,
        "A timer command must not change the stored mood-light state."
    );

    humidifier.applyReport({
        poweron: false,
        rgblevel: 2,
    });

    await humidifier.setPowerOnTimer(5);

    assert.equal(readTimerCommand(websocket, "timeron").du, 5);
    assert.equal(
        humidifier.state.raw.rgblevel,
        2,
        "A stored mood-light value must not block or be changed by the power-on timer."
    );

    const deviceWithoutPowerOn = new DreoDevice(
        {
            ...deviceDefinition,
            sn: "power-timer-test-without-poweron",
            model: "DR-HCF001S",
        },
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            fanon: false,
            lighton: false,
            timeron: {
                du: 0,
                ts: 200,
            },
            timeroff: {
                du: 0,
                ts: 200,
            },
        }
    );

    await deviceWithoutPowerOn.setPowerOnTimer(60);

    assert.equal(readTimerCommand(websocket, "timeron").du, 60);

    deviceWithoutPowerOn.applyReport({
        fanon: true,
    });

    await expectValidationError(
        async () => deviceWithoutPowerOn.setPowerOnTimer(10)
    );

    await deviceWithoutPowerOn.setPowerOffTimer(10);

    assert.equal(readTimerCommand(websocket, "timeroff").du, 10);

    deviceWithoutPowerOn.applyReport({
        fanon: false,
        lighton: false,
    });

    await expectValidationError(
        async () => deviceWithoutPowerOn.setPowerOffTimer(10)
    );

    const deviceWithUnknownPowerState = new DreoDevice(
        {
            ...deviceDefinition,
            sn: "power-timer-test-unknown-state",
        },
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            timeron: {
                du: 0,
                ts: 300,
            },
            timeroff: {
                du: 0,
                ts: 300,
            },
        }
    );

    await expectValidationError(
        async () => deviceWithUnknownPowerState.setPowerOnTimer(1)
    );

    await expectValidationError(
        async () => deviceWithUnknownPowerState.setPowerOffTimer(1)
    );

    poweredDevice.applyReport({
        timeron: {
            du: 10,
            ts: 400,
        },
    });

    poweredDevice.applyReport({
        timeron: {
            du: 10.5,
            ts: 401,
        },
    });

    assert.deepEqual(
        poweredDevice.state.powerOnTimer,
        {
            du: 10,
            ts: 400,
        },
        "An invalid timer report must preserve the last valid configuration."
    );

    const humidifierCompletionDevice = new DreoDevice(
        {
            ...deviceDefinition,
            sn: "power-timer-completion-humidifier",
            model: "DR-HHM001S",
            productName: "Humidifier",
        },
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            timeron: {
                du: 0,
                ts: 600,
            },
            timeroff: {
                du: 1,
                ts: 601,
            },
        }
    );

    humidifierCompletionDevice.applyReport({
        timeroff: {
            du: 0,
        },
        poweron: false,
    });

    assert.deepEqual(
        humidifierCompletionDevice.state.powerOffTimer,
        {
            du: 0,
            ts: 601,
        },
        "A confirmed power-off completion may omit ts."
    );

    assert.deepEqual(
        humidifierCompletionDevice.state.raw.timeroff,
        {
            du: 0,
        },
        "The RAW timer report must remain unchanged."
    );

    humidifierCompletionDevice.applyReport({
        timeron: {
            du: 5,
            ts: 610,
        },
        poweron: false,
    });

    humidifierCompletionDevice.applyReport({
        timeron: {
            du: 0,
        },
        poweron: true,
    });

    assert.deepEqual(
        humidifierCompletionDevice.state.powerOnTimer,
        {
            du: 0,
            ts: 610,
        },
        "The generic completion fallback must also support timeron."
    );

    const guardedIncompleteTimerDevice = new DreoDevice(
        {
            ...deviceDefinition,
            sn: "power-timer-incomplete-guard",
        },
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            timeroff: {
                du: 10,
                ts: 620,
            },
        }
    );

    guardedIncompleteTimerDevice.applyReport({
        timeroff: {
            du: 0,
        },
    });

    assert.deepEqual(
        guardedIncompleteTimerDevice.state.powerOffTimer,
        {
            du: 10,
            ts: 620,
        },
        "An incomplete timer report without an explicit target state must not complete the timer."
    );

    guardedIncompleteTimerDevice.applyReport({
        timeroff: {
            du: 0,
        },
        poweron: true,
    });

    assert.deepEqual(
        guardedIncompleteTimerDevice.state.powerOffTimer,
        {
            du: 10,
            ts: 620,
        },
        "An incomplete timer report with the wrong target state must not complete the timer."
    );

    guardedIncompleteTimerDevice.applyReport({
        timeroff: {},
        poweron: false,
    });

    assert.deepEqual(
        guardedIncompleteTimerDevice.state.powerOffTimer,
        {
            du: 10,
            ts: 620,
        },
        "A timer report without both du and ts must remain invalid."
    );

    const componentCompletionDevice = new DreoDevice(
        {
            ...deviceDefinition,
            sn: "power-timer-completion-without-poweron",
            model: "DR-HCF001S",
        },
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            fanon: true,
            lighton: false,
            timeron: {
                du: 0,
                ts: 630,
            },
            timeroff: {
                du: 1,
                ts: 631,
            },
        }
    );

    componentCompletionDevice.applyReport({
        timeroff: JSON.stringify({
            du: 0,
        }),
        fanon: false,
    });

    assert.deepEqual(
        componentCompletionDevice.state.powerOffTimer,
        {
            du: 0,
            ts: 631,
        },
        "Devices without poweron may confirm power-off completion through their components."
    );

    componentCompletionDevice.applyReport({
        timeron: {
            du: 5,
            ts: 640,
        },
    });

    componentCompletionDevice.applyReport({
        timeron: {
            ts: 641,
        },
        lighton: true,
    });

    assert.deepEqual(
        componentCompletionDevice.state.powerOnTimer,
        {
            du: 0,
            ts: 641,
        },
        "A missing du may be reconciled when components confirm power-on completion."
    );

    const completeReportDevice = new DreoDevice(
        {
            ...deviceDefinition,
            sn: "power-timer-complete-report",
            model: "DR-HCF007S",
        },
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            timeroff: {
                du: 1,
                ts: 650,
            },
        }
    );

    completeReportDevice.applyReport({
        timeroff: {
            du: 0,
            ts: 651,
        },
        poweron: false,
    });

    assert.deepEqual(
        completeReportDevice.state.powerOffTimer,
        {
            du: 0,
            ts: 651,
        },
        "Complete timer reports must retain their original behavior."
    );

    const malformedPowerCompletionDevice = new DreoDevice(
        {
            ...deviceDefinition,
            sn: "power-timer-malformed-power-confirmation",
        },
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            poweron: true,
            timeroff: {
                du: 1,
                ts: 660,
            },
        }
    );

    malformedPowerCompletionDevice.applyReport({
        timeroff: {
            du: 0,
        },
        poweron: "false",
    });

    assert.deepEqual(
        malformedPowerCompletionDevice.state.powerOffTimer,
        {
            du: 1,
            ts: 660,
        },
        "A malformed poweron value must not confirm timer completion."
    );

    const malformedComponentCompletionDevice = new DreoDevice(
        {
            ...deviceDefinition,
            sn: "power-timer-malformed-component-confirmation",
            model: "DR-HCF001S",
        },
        websocket as unknown as DreoWebSocketClient,
        constraints,
        {
            fanon: true,
            lighton: false,
            timeroff: {
                du: 1,
                ts: 670,
            },
        }
    );

    malformedComponentCompletionDevice.applyReport({
        timeroff: {
            du: 0,
        },
        fanon: 0,
    });

    assert.deepEqual(
        malformedComponentCompletionDevice.state.powerOffTimer,
        {
            du: 1,
            ts: 670,
        },
        "A malformed component value must not confirm timer completion."
    );

    console.log("Power timer test successful.");
}

main().catch((error: unknown) => {
    console.error("Power timer test failed:");
    console.error(error);
    process.exitCode = 1;
});
