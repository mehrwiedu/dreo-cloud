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
    deviceId: "directional-angle-test",
    sn: "directional-angle-test-sn",
    deviceName: "Directional angle test",
    brand: "DREO",
    model: "DR-HPF002S",
    productId: "directional-angle-test-product",
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

function createStandFan(
    websocket: MockWebSocket,
    initialRawState: Record<string, unknown>
): DreoDevice {
    const constraints = new Map<string, StateConstraint>([
        [
            "oscmode",
            {
                type: "number",
                step: 1,
            },
        ],
        [
            "cruiseconf",
            {
                type: "string",
            },
        ],
    ]);

    return new DreoDevice(
        standFanDefinition,
        websocket as unknown as DreoWebSocketClient,
        constraints,
        initialRawState
    );
}

async function main(): Promise<void> {
    const horizontalWebSocket = new MockWebSocket();

    const horizontalFan = createStandFan(
        horizontalWebSocket,
        {
            poweron: true,
            fanon: true,
            oscmode:
                DreoDirectionalOscillationMode.Horizontal,
            cruiseconf: "90,60,-30,-60",
        }
    );

    assert.deepEqual(
        horizontalFan.state
            .directionalOscillationConfiguration,
        {
            verticalUpper: 90,
            horizontalRight: 60,
            verticalLower: -30,
            horizontalLeft: -60,
            horizontalAngle: 120,
            verticalAngle: 120,
        }
    );

    await horizontalFan.setHorizontalOscillationAngle(90);

    assert.deepEqual(
        horizontalWebSocket.commands.at(-1),
        {
            cruiseconf: "90,45,-30,-45",
        },
        "Horizontal preset must preserve the vertical endpoints."
    );

    assert.equal(
        horizontalFan.state
            .directionalOscillationConfiguration
            ?.horizontalAngle,
        90
    );

    assert.equal(
        horizontalFan.state
            .directionalOscillationConfiguration
            ?.verticalAngle,
        120
    );

    assert.equal(
        horizontalFan.state.directionalOscillationMode,
        DreoDirectionalOscillationMode.Horizontal,
        "Changing an angle must not change oscmode."
    );

    assert.equal(
        horizontalFan.state.power,
        true,
        "Changing an angle must not synthesize power."
    );

    assert.equal(
        horizontalFan.state.fan,
        true,
        "Changing an angle must not synthesize fanon."
    );

    const verticalWebSocket = new MockWebSocket();

    const verticalFan = createStandFan(
        verticalWebSocket,
        {
            poweron: true,
            fanon: true,
            oscmode:
                DreoDirectionalOscillationMode.Vertical,
            cruiseconf: "90,60,-30,-60",
        }
    );

    await verticalFan.setVerticalOscillationAngle(90);

    assert.deepEqual(
        verticalWebSocket.commands.at(-1),
        {
            cruiseconf: "60,60,-30,-60",
        },
        "Vertical preset must retain the lower endpoint and preserve the horizontal range."
    );

    assert.equal(
        verticalFan.state
            .directionalOscillationConfiguration
            ?.verticalAngle,
        90
    );

    assert.equal(
        verticalFan.state
            .directionalOscillationConfiguration
            ?.horizontalAngle,
        120
    );

    assert.equal(
        verticalFan.state.directionalOscillationMode,
        DreoDirectionalOscillationMode.Vertical,
        "Changing a vertical angle must not change oscmode."
    );

    const bothWebSocket = new MockWebSocket();

    const bothFan = createStandFan(
        bothWebSocket,
        {
            poweron: true,
            fanon: true,
            oscmode:
                DreoDirectionalOscillationMode.Both,
            cruiseconf: "90,60,-30,-60",
        }
    );

    await bothFan.setHorizontalOscillationAngle(60);

    assert.deepEqual(
        bothWebSocket.commands.at(-1),
        {
            cruiseconf: "90,30,-30,-30",
        }
    );

    await bothFan.setVerticalOscillationAngle(30);

    assert.deepEqual(
        bothWebSocket.commands.at(-1),
        {
            cruiseconf: "0,30,-30,-30",
        },
        "Each axis must preserve the current configuration of the other axis."
    );

    assert.deepEqual(
        bothFan.state
            .directionalOscillationConfiguration,
        {
            verticalUpper: 0,
            horizontalRight: 30,
            verticalLower: -30,
            horizontalLeft: -30,
            horizontalAngle: 60,
            verticalAngle: 30,
        }
    );

    const customRangeWebSocket = new MockWebSocket();

    const customRangeFan = createStandFan(
        customRangeWebSocket,
        {
            poweron: true,
            fanon: true,
            oscmode:
                DreoDirectionalOscillationMode.Both,
            cruiseconf: "90,50,-10,-50",
        }
    );

    assert.equal(
        customRangeFan.state
            .directionalOscillationConfiguration
            ?.horizontalAngle,
        100,
        "Non-preset app ranges must remain readable."
    );

    assert.equal(
        customRangeFan.state
            .directionalOscillationConfiguration
            ?.verticalAngle,
        100,
        "Non-preset app ranges must remain readable."
    );

    await customRangeFan.setHorizontalOscillationAngle(30);

    assert.deepEqual(
        customRangeWebSocket.commands.at(-1),
        {
            cruiseconf: "90,15,-10,-15",
        },
        "A horizontal quick preset must preserve the complete custom vertical range."
    );

    await customRangeFan.setVerticalOscillationAngle(60);

    assert.deepEqual(
        customRangeWebSocket.commands.at(-1),
        {
            cruiseconf: "30,15,-30,-15",
        },
        "A vertical quick preset must use the confirmed -30 lower endpoint and preserve the horizontal preset."
    );

    const invalidAngleCommandCount =
        customRangeWebSocket.commands.length;

    for (const invalidAngle of [
        -1,
        0,
        29,
        45,
        121,
        30.5,
        Number.NaN,
    ]) {
        await expectValidationError(
            async () =>
                customRangeFan
                    .setHorizontalOscillationAngle(
                        invalidAngle
                    )
        );

        await expectValidationError(
            async () =>
                customRangeFan
                    .setVerticalOscillationAngle(
                        invalidAngle
                    )
        );
    }

    assert.equal(
        customRangeWebSocket.commands.length,
        invalidAngleCommandCount,
        "Invalid presets must not send commands."
    );

    const inactiveWebSocket = new MockWebSocket();

    const inactiveFan = createStandFan(
        inactiveWebSocket,
        {
            poweron: true,
            fanon: true,
            oscmode:
                DreoDirectionalOscillationMode.Off,
            cruiseconf: "90,60,-30,-60",
        }
    );

    await expectValidationError(
        async () =>
            inactiveFan
                .setHorizontalOscillationAngle(30)
    );

    await expectValidationError(
        async () =>
            inactiveFan
                .setVerticalOscillationAngle(30)
    );

    inactiveFan.applyReport({
        oscmode:
            DreoDirectionalOscillationMode.Horizontal,
    });

    await expectValidationError(
        async () =>
            inactiveFan
                .setVerticalOscillationAngle(30)
    );

    inactiveFan.applyReport({
        oscmode:
            DreoDirectionalOscillationMode.Vertical,
    });

    await expectValidationError(
        async () =>
            inactiveFan
                .setHorizontalOscillationAngle(30)
    );

    assert.equal(
        inactiveWebSocket.commands.length,
        0,
        "Inactive axes must not send commands."
    );

    const staleModeWebSocket = new MockWebSocket();

    const staleModeFan = createStandFan(
        staleModeWebSocket,
        {
            poweron: true,
            fanon: true,
            oscmode:
                DreoDirectionalOscillationMode.Both,
            cruiseconf: "90,60,-30,-60",
        }
    );

    staleModeFan.applyReport({
        oscmode: 2.5,
    });

    assert.equal(
        staleModeFan.state.directionalOscillationMode,
        DreoDirectionalOscillationMode.Both,
        "An invalid mode report must preserve the last valid mode for reading."
    );

    const commandCountBeforeStaleModeWrites =
        staleModeWebSocket.commands.length;

    await expectValidationError(
        async () =>
            staleModeFan
                .setHorizontalOscillationAngle(30)
    );

    await expectValidationError(
        async () =>
            staleModeFan
                .setVerticalOscillationAngle(30)
    );

    assert.equal(
        staleModeWebSocket.commands.length,
        commandCountBeforeStaleModeWrites,
        "An invalid current raw mode must block both angle setters."
    );

    staleModeFan.applyReport({
        oscmode:
            DreoDirectionalOscillationMode.Horizontal,
    });

    await staleModeFan.setHorizontalOscillationAngle(30);

    assert.deepEqual(
        staleModeWebSocket.commands.at(-1),
        {
            cruiseconf: "90,15,-30,-15",
        },
        "Horizontal writes must resume after a valid active mode is reported."
    );

    await expectValidationError(
        async () =>
            staleModeFan
                .setVerticalOscillationAngle(30)
    );

    const malformedWebSocket = new MockWebSocket();

    const malformedFan = createStandFan(
        malformedWebSocket,
        {
            poweron: true,
            fanon: true,
            oscmode:
                DreoDirectionalOscillationMode.Both,
            cruiseconf: "90,60,-30,-60",
        }
    );

    malformedFan.applyReport({
        cruiseconf: "invalid",
    });

    assert.deepEqual(
        malformedFan.state
            .directionalOscillationConfiguration,
        {
            verticalUpper: 90,
            horizontalRight: 60,
            verticalLower: -30,
            horizontalLeft: -60,
            horizontalAngle: 120,
            verticalAngle: 120,
        },
        "A malformed report must preserve the last valid cruise configuration for reading."
    );

    const commandCountBeforeMalformedWrites =
        malformedWebSocket.commands.length;

    await expectValidationError(
        async () =>
            malformedFan
                .setHorizontalOscillationAngle(30)
    );

    await expectValidationError(
        async () =>
            malformedFan
                .setVerticalOscillationAngle(30)
    );

    assert.equal(
        malformedWebSocket.commands.length,
        commandCountBeforeMalformedWrites,
        "A malformed current cruise configuration must block angle writes."
    );

    malformedFan.applyReport({
        cruiseconf: "90,60,-30,-60",
    });

    await malformedFan.setHorizontalOscillationAngle(30);

    assert.deepEqual(
        malformedWebSocket.commands.at(-1),
        {
            cruiseconf: "90,15,-30,-15",
        },
        "Angle writes must resume after a valid current cruise configuration is reported."
    );

    const missingConfigurationWebSocket =
        new MockWebSocket();

    const missingConfigurationFan = createStandFan(
        missingConfigurationWebSocket,
        {
            poweron: true,
            fanon: true,
            oscmode:
                DreoDirectionalOscillationMode.Both,
        }
    );

    await expectValidationError(
        async () =>
            missingConfigurationFan
                .setHorizontalOscillationAngle(30)
    );

    await expectValidationError(
        async () =>
            missingConfigurationFan
                .setVerticalOscillationAngle(30)
    );

    assert.equal(
        missingConfigurationWebSocket.commands.length,
        0
    );

    const heaterWebSocket = new MockWebSocket();

    const heater = new DreoDevice(
        {
            ...standFanDefinition,
            sn: "directional-angle-heater",
            model: "DR-HSH034S",
            productName: "Heater",
        },
        heaterWebSocket as unknown as DreoWebSocketClient,
        new Map([
            [
                "oscmode",
                {
                    type: "number",
                    step: 1,
                } satisfies StateConstraint,
            ],
            [
                "cruiseconf",
                {
                    type: "string",
                } satisfies StateConstraint,
            ],
        ]),
        {
            poweron: true,
            oscmode: 3,
            cruiseconf: "90,60,-30,-60",
        }
    );

    assert.equal(
        heater.state
            .directionalOscillationConfiguration,
        undefined,
        "A different cruiseconf semantic must not be exposed."
    );

    await expectValidationError(
        async () =>
            heater.setHorizontalOscillationAngle(30)
    );

    await expectValidationError(
        async () =>
            heater.setVerticalOscillationAngle(30)
    );

    assert.equal(
        heaterWebSocket.commands.length,
        0
    );

    console.log(
        "Directional oscillation angle test successful."
    );
}

await main();
