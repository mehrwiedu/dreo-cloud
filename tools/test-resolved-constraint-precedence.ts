import assert from "node:assert/strict";

import { DreoDevice } from "../packages/dreo-api/src/DreoDevice.js";
import { ResolvedDeviceResolver } from "../packages/dreo-api/src/ResolvedDeviceResolver.js";
import type { Device } from "../packages/dreo-api/src/models/Device.js";
import type { DeviceStateResponse } from "../packages/dreo-api/src/models/DeviceStateResponse.js";
import type { StateConstraint } from "../packages/dreo-api/src/models/StateConstraint.js";
import type { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

const device = {
    deviceId: "constraint-precedence-test",
    sn: "constraint-precedence-test-sn",
    deviceName: "Constraint precedence test",
    brand: "DREO",
    model: "DR-HHM001S",
    productId: "constraint-precedence-test-product",
    productName: "Humidifier",
    owner: true,
    shared: false,
    capabilities: {
        controlsConf: {
            preference: [
                {
                    cmd: "ledlevel",
                },
                {
                    cmd: "unknownpreference",
                },
            ],
            control: [
                {
                    type: "Speed",
                    items: Array.from(
                        {
                            length: 9,
                        },
                        (_, index) => ({
                            cmd: "windlevel",
                            value: index,
                        }),
                    ),
                },
                {
                    type: "Mode",
                    items: Array.from(
                        {
                            length: 6,
                        },
                        (_, index) => ({
                            cmd: "rgbpresetsel",
                            value: index,
                        }),
                    ),
                },
            ],
        },
    },
} as unknown as Device;

const state = {
    data: {
        mixed: {
            poweron: {
                state: true,
            },
            ledlevel: {
                state: 2,
            },
            windlevel: {
                state: 4,
            },
            rgbpresetsel: {
                state: 2,
            },
            unknownpreference: {
                state: true,
            },
        },
    },
} as unknown as DeviceStateResponse;

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
            devicesn: device.sn,
            reported: params,
        };
    }
}

function requireState(
    resolvedStates: ReturnType<ResolvedDeviceResolver["resolve"]>["states"],
    key: string,
) {
    const discoveredState = resolvedStates.find(
        (candidate) => candidate.key === key,
    );

    assert.ok(discoveredState, `Expected resolved state ${key}.`);

    return discoveredState;
}

async function main(): Promise<void> {
    const resolver = new ResolvedDeviceResolver();
    const resolvedDevice = resolver.resolve(device, state);

    const ledLevel = requireState(resolvedDevice.states, "ledlevel");

    assert.equal(ledLevel.known, true);
    assert.equal(ledLevel.writable, true);
    assert.equal(ledLevel.valueType, "number");
    assert.deepEqual(
        ledLevel.constraint,
        {
            type: "number",
            allowedValues: [0, 2],
        },
        "A conflicting boolean preference must not replace the known numeric registry constraint.",
    );

    const windLevel = requireState(resolvedDevice.states, "windlevel");

    assert.deepEqual(
        windLevel.constraint,
        {
            type: "number",
            min: 1,
            max: 8,
            step: 1,
            allowedValues: undefined,
        },
        "Device metadata must narrow the registry maximum without lowering its confirmed minimum.",
    );

    const rgbPreset = requireState(
        resolvedDevice.states,
        "rgbpresetsel",
    );

    assert.deepEqual(
        rgbPreset.constraint,
        {
            type: "number",
            min: 0,
            max: 4,
            step: 1,
            allowedValues: [0, 1, 2, 3, 4],
        },
        "Device metadata must not add an unconfirmed value to a known registry enumeration.",
    );

    const unknownPreference = requireState(
        resolvedDevice.states,
        "unknownpreference",
    );

    assert.equal(unknownPreference.known, false);
    assert.deepEqual(
        unknownPreference.constraint,
        {
            type: "boolean",
        },
        "An unknown preference must still receive its device-derived boolean constraint.",
    );

    const stateConstraints = new Map<string, StateConstraint>(
        resolvedDevice.states.flatMap((discoveredState) =>
            discoveredState.constraint
                ? [[discoveredState.key, discoveredState.constraint]]
                : [],
        ),
    );

    const websocket = new MockWebSocket();

    const sdkDevice = new DreoDevice(
        device,
        websocket as unknown as DreoWebSocketClient,
        stateConstraints,
        {
            poweron: true,
            ledlevel: 2,
        },
    );

    await sdkDevice.setDisplay(false);

    assert.deepEqual(
        websocket.commands.at(-1),
        {
            ledlevel: 0,
        },
        "The resolved numeric constraint must permit the native display-off command.",
    );

    await sdkDevice.setDisplay(true);

    assert.deepEqual(
        websocket.commands.at(-1),
        {
            ledlevel: 2,
        },
        "The resolved numeric constraint must permit the native display-on command.",
    );

    console.log("Resolved constraint precedence test successful.");
}

await main();
