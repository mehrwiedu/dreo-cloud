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

function createConstraints(): ReadonlyMap<string, StateConstraint> {
    return new Map([
        [
            "mode",
            {
                type: "number",
                step: 1,
                allowedValues: [0, 1, 2],
            },
        ],
        [
            "foglevel",
            {
                type: "number",
                min: 0,
                max: 6,
                step: 1,
            },
        ],
        [
            "rhautolevel",
            {
                type: "number",
                min: 30,
                max: 80,
                step: 1,
            },
        ],
        [
            "filteron",
            {
                type: "boolean",
            },
        ],
    ]);
}

function createHumidifier(
    websocket: RecordingWebSocket,
    rawState: Record<string, unknown> = {
        poweron: true,
        mode: 0,
        foglevel: 3,
        rhautolevel: 60,
        rhsleeplevel: 70,
        ledlevel: 2,
        rgblevel: 2,
        muteon: false,
        filteron: true,
        filtertime: 100,
        worktime: 0,
        rgbth: "30,60",
    },
    model = "DR-HHM001S",
): DreoDevice {
    return new DreoDevice(
        {
            sn: `${model}-humidifier-controls-test`,
            model,
            deviceName: "Humidifier controls test",
        } as never,
        websocket as unknown as DreoWebSocketClient,
        createConstraints(),
        rawState,
    );
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

function assertLastCommand(
    websocket: RecordingWebSocket,
    expected: Record<string, unknown>,
    description: string,
): void {
    assert.deepEqual(websocket.commands.at(-1), expected, description);
}

async function testHumidifierModes(): Promise<void> {
    const websocket = new RecordingWebSocket();
    const device = createHumidifier(websocket);

    const initialFogLevel = device.state.raw.foglevel;
    const initialAutoHumidity = device.state.raw.rhautolevel;
    const initialSleepHumidity = device.state.raw.rhsleeplevel;
    const initialPower = device.state.raw.poweron;
    const initialDisplay = device.state.raw.ledlevel;
    const initialMoodLight = device.state.raw.rgblevel;
    const initialMute = device.state.raw.muteon;

    for (const mode of [0, 1, 2] as const) {
        await device.setHumidifierMode(mode);

        assertLastCommand(
            websocket,
            {
                mode,
            },
            `Humidifier mode ${mode} must send only mode.`,
        );

        assert.equal(device.state.mode, mode);
        assert.equal(device.state.raw.foglevel, initialFogLevel);
        assert.equal(device.state.raw.rhautolevel, initialAutoHumidity);
        assert.equal(device.state.raw.rhsleeplevel, initialSleepHumidity);
        assert.equal(device.state.raw.poweron, initialPower);
        assert.equal(device.state.raw.ledlevel, initialDisplay);
        assert.equal(device.state.raw.rgblevel, initialMoodLight);
        assert.equal(device.state.raw.muteon, initialMute);
    }

    const commandCountBeforeSameValueWrite = websocket.commands.length;

    await device.setHumidifierMode(2);

    assert.equal(
        websocket.commands.length,
        commandCountBeforeSameValueWrite + 1,
        "An explicitly requested identical humidifier mode must be forwarded.",
    );

    assertLastCommand(
        websocket,
        {
            mode: 2,
        },
        "An identical humidifier-mode write must send only mode.",
    );

    const commandCountBeforeInvalidModes = websocket.commands.length;

    await expectValidationError(
        async () => device.setHumidifierMode(-1),
        "Negative humidifier mode",
    );
    await expectValidationError(
        async () => device.setHumidifierMode(3),
        "Humidifier mode three",
    );
    await expectValidationError(
        async () => device.setHumidifierMode(1.5),
        "Fractional humidifier mode",
    );
    await expectValidationError(async () => {
        await (
            device.setHumidifierMode as unknown as (
                value: unknown,
            ) => Promise<void>
        )("auto");
    }, "String humidifier mode");

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidModes,
        "Invalid humidifier modes must not reach the WebSocket.",
    );
}

async function testManualFogLevel(): Promise<void> {
    const websocket = new RecordingWebSocket();
    const device = createHumidifier(websocket);

    for (const level of [1, 6]) {
        await device.setHumidifierFogLevel(level);

        assertLastCommand(
            websocket,
            {
                foglevel: level,
            },
            `Fog level ${level} must send only foglevel.`,
        );

        assert.equal(device.state.raw.foglevel, level);
        assert.equal(device.state.mode, 0);
    }

    const commandCountBeforeSameValueWrite = websocket.commands.length;

    await device.setHumidifierFogLevel(6);

    assert.equal(
        websocket.commands.length,
        commandCountBeforeSameValueWrite + 1,
        "An identical fog level must be forwarded.",
    );

    const commandCountBeforeInvalidLevels = websocket.commands.length;

    await expectValidationError(
        async () => device.setHumidifierFogLevel(0),
        "Fog level zero",
    );
    await expectValidationError(
        async () => device.setHumidifierFogLevel(7),
        "Fog level seven",
    );
    await expectValidationError(
        async () => device.setHumidifierFogLevel(2.5),
        "Fractional fog level",
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidLevels,
        "Invalid fog levels must not reach the WebSocket.",
    );

    device.applyReport({
        mode: 1,
    });

    await expectValidationError(
        async () => device.setHumidifierFogLevel(3),
        "Fog level outside manual mode",
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidLevels,
        "Fog-level writes outside mode 0 must not reach the WebSocket.",
    );
}

async function testAutomaticTargetHumidity(): Promise<void> {
    const websocket = new RecordingWebSocket();
    const device = createHumidifier(websocket, {
        poweron: true,
        mode: 1,
        foglevel: 3,
        rhautolevel: 60,
        rhsleeplevel: 70,
        ledlevel: 2,
        rgblevel: 2,
        muteon: false,
    });

    for (const humidity of [30, 90]) {
        await device.setHumidifierAutoTargetHumidity(humidity);

        assertLastCommand(
            websocket,
            {
                rhautolevel: humidity,
            },
            `Automatic target ${humidity} must send only rhautolevel.`,
        );

        assert.equal(device.state.raw.rhautolevel, humidity);
        assert.equal(device.state.mode, 1);
    }

    assert.equal(
        device.state.raw.rhautolevel,
        90,
        "The confirmed range must override stale metadata capped at 80.",
    );

    const commandCountBeforeInvalidValues = websocket.commands.length;

    await expectValidationError(
        async () => device.setHumidifierAutoTargetHumidity(29),
        "Automatic target below 30",
    );
    await expectValidationError(
        async () => device.setHumidifierAutoTargetHumidity(91),
        "Automatic target above 90",
    );
    await expectValidationError(
        async () => device.setHumidifierAutoTargetHumidity(60.5),
        "Fractional automatic target",
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidValues,
        "Invalid automatic targets must not reach the WebSocket.",
    );

    device.applyReport({
        mode: 0,
    });

    await expectValidationError(
        async () => device.setHumidifierAutoTargetHumidity(60),
        "Automatic target outside automatic mode",
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidValues,
        "Automatic target writes outside mode 1 must not reach the WebSocket.",
    );
}

async function testSleepTargetHumidity(): Promise<void> {
    const websocket = new RecordingWebSocket();
    const device = createHumidifier(websocket, {
        poweron: true,
        mode: 2,
        foglevel: 3,
        rhautolevel: 60,
        rhsleeplevel: 70,
        ledlevel: 2,
        rgblevel: 2,
        muteon: false,
    });

    for (const humidity of [30, 90]) {
        await device.setHumidifierSleepTargetHumidity(humidity);

        assertLastCommand(
            websocket,
            {
                rhsleeplevel: humidity,
            },
            `Sleep target ${humidity} must send only rhsleeplevel.`,
        );

        assert.equal(device.state.raw.rhsleeplevel, humidity);
        assert.equal(device.state.mode, 2);
    }

    const commandCountBeforeInvalidValues = websocket.commands.length;

    await expectValidationError(
        async () => device.setHumidifierSleepTargetHumidity(29),
        "Sleep target below 30",
    );
    await expectValidationError(
        async () => device.setHumidifierSleepTargetHumidity(91),
        "Sleep target above 90",
    );
    await expectValidationError(
        async () => device.setHumidifierSleepTargetHumidity(70.5),
        "Fractional sleep target",
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidValues,
        "Invalid sleep targets must not reach the WebSocket.",
    );

    device.applyReport({
        mode: 1,
    });

    await expectValidationError(
        async () => device.setHumidifierSleepTargetHumidity(70),
        "Sleep target outside sleep mode",
    );

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidValues,
        "Sleep target writes outside mode 2 must not reach the WebSocket.",
    );
}

async function testHhm003sSharedHumidifierSemantics(): Promise<void> {
    const websocket = new RecordingWebSocket();
    const device = createHumidifier(
        websocket,
        {
            poweron: true,
            mode: 0,
            foglevel: 4,
            rhautolevel: 45,
            rhsleeplevel: 90,
            ledlevel: 1,
            rgblevel: 2,
            muteon: true,
            filteron: true,
            filtertime: 99,
            worktime: 13,
            rgbth: "30,60",
            hotfogon: false,
        },
        "DR-HHM003S",
    );

    assert.equal(device.state.filterLifeRemaining, 99);
    assert.equal(device.state.humidityIndicatorLowerThreshold, 30);
    assert.equal(device.state.humidityIndicatorUpperThreshold, 60);

    await device.setHumidifierMode(0);
    assertLastCommand(
        websocket,
        { mode: 0 },
        "DR-HHM003S manual mode must send only mode.",
    );

    await device.setHumidifierFogLevel(6);
    assertLastCommand(
        websocket,
        { foglevel: 6 },
        "DR-HHM003S fog level must send only foglevel.",
    );

    device.applyReport({ mode: 1 });

    await device.setHumidifierAutoTargetHumidity(90);
    assertLastCommand(
        websocket,
        { rhautolevel: 90 },
        "DR-HHM003S automatic target must send only rhautolevel.",
    );

    device.applyReport({ mode: 2 });

    await device.setHumidifierSleepTargetHumidity(30);
    assertLastCommand(
        websocket,
        { rhsleeplevel: 30 },
        "DR-HHM003S sleep target must send only rhsleeplevel.",
    );

    await device.setHumidifierFilterInstalled(false);
    assertLastCommand(
        websocket,
        { filteron: false },
        "DR-HHM003S filter confirmation must send only filteron.",
    );
}

async function testHumidityIndicatorThresholds(): Promise<void> {
    for (const model of ["DR-HHM001S", "DR-HHM003S"]) {
        const websocket = new RecordingWebSocket();
        const device = createHumidifier(
            websocket,
            {
                poweron: true,
                mode: 0,
                foglevel: 3,
                rhautolevel: 60,
                rhsleeplevel: 70,
                filteron: true,
                filtertime: 100,
                worktime: 0,
                rgbth: "30,60",
            },
            model,
        );

        assert.equal(
            device.state.humidityIndicatorLowerThreshold,
            30,
            `${model} must parse the lower rgbth component.`,
        );
        assert.equal(
            device.state.humidityIndicatorUpperThreshold,
            60,
            `${model} must parse the upper rgbth component.`,
        );

        await device.setHumidifierLowerHumidityThreshold(40);

        assertLastCommand(
            websocket,
            {
                rgbth: "40,60",
            },
            `${model} lower threshold must preserve the current upper threshold.`,
        );

        assert.equal(
            device.state.humidityIndicatorLowerThreshold,
            40,
        );
        assert.equal(
            device.state.humidityIndicatorUpperThreshold,
            60,
        );

        await device.setHumidifierUpperHumidityThreshold(70);

        assertLastCommand(
            websocket,
            {
                rgbth: "40,70",
            },
            `${model} upper threshold must preserve the current lower threshold.`,
        );

        assert.equal(
            device.state.humidityIndicatorLowerThreshold,
            40,
        );
        assert.equal(
            device.state.humidityIndicatorUpperThreshold,
            70,
        );

        const commandCountBeforeInvalidWrites =
            websocket.commands.length;

        for (const invalidLower of [14, 66, 81]) {
            await expectValidationError(
                async () =>
                    device.setHumidifierLowerHumidityThreshold(
                        invalidLower,
                    ),
                `${model} invalid lower threshold ${invalidLower}`,
            );
        }

        for (const invalidUpper of [19, 44, 86]) {
            await expectValidationError(
                async () =>
                    device.setHumidifierUpperHumidityThreshold(
                        invalidUpper,
                    ),
                `${model} invalid upper threshold ${invalidUpper}`,
            );
        }

        assert.equal(
            websocket.commands.length,
            commandCountBeforeInvalidWrites,
            `${model} invalid humidity thresholds must not reach the WebSocket.`,
        );

        device.applyReport({
            rgbth: "15,20",
        });

        assert.equal(
            device.state.humidityIndicatorLowerThreshold,
            15,
        );
        assert.equal(
            device.state.humidityIndicatorUpperThreshold,
            20,
        );

        device.applyReport({
            rgbth: "80,85",
        });

        assert.equal(
            device.state.humidityIndicatorLowerThreshold,
            80,
        );
        assert.equal(
            device.state.humidityIndicatorUpperThreshold,
            85,
        );

        device.applyReport({
            rgbth: "81,85",
        });

        assert.equal(
            device.state.humidityIndicatorLowerThreshold,
            80,
            `${model} invalid reports must not replace the last confirmed lower threshold.`,
        );
        assert.equal(
            device.state.humidityIndicatorUpperThreshold,
            85,
            `${model} invalid reports must not replace the last confirmed upper threshold.`,
        );
    }
}

async function testFilterInstalled(): Promise<void> {
    const websocket = new RecordingWebSocket();
    const device = createHumidifier(websocket);

    const initialPower = device.state.raw.poweron;
    const initialMode = device.state.raw.mode;
    const initialFilterTime = device.state.raw.filtertime;
    const initialWorkTime = device.state.raw.worktime;

    for (const enabled of [false, true]) {
        await device.setHumidifierFilterInstalled(enabled);

        assertLastCommand(
            websocket,
            {
                filteron: enabled,
            },
            `Filter confirmation ${enabled} must send only filteron.`,
        );

        assert.equal(device.state.raw.filteron, enabled);
        assert.equal(device.state.raw.poweron, initialPower);
        assert.equal(device.state.raw.mode, initialMode);
        assert.equal(device.state.raw.filtertime, initialFilterTime);
        assert.equal(device.state.raw.worktime, initialWorkTime);
    }

    const commandCountBeforeSameValueWrite = websocket.commands.length;

    await device.setHumidifierFilterInstalled(true);

    assert.equal(
        websocket.commands.length,
        commandCountBeforeSameValueWrite + 1,
        "An explicitly requested identical filter confirmation must be forwarded.",
    );

    assertLastCommand(
        websocket,
        {
            filteron: true,
        },
        "An identical filter confirmation must send only filteron.",
    );

    const commandCountBeforeInvalidValue = websocket.commands.length;

    await expectValidationError(async () => {
        await (
            device.setHumidifierFilterInstalled as unknown as (
                value: unknown,
            ) => Promise<void>
        )("true");
    }, "String filter confirmation");

    assert.equal(
        websocket.commands.length,
        commandCountBeforeInvalidValue,
        "An invalid filter confirmation must not reach the WebSocket.",
    );
}

async function testModelAndStateGuards(): Promise<void> {
    const unsupportedWebSocket = new RecordingWebSocket();
    const unsupportedDevice = new DreoDevice(
        {
            sn: "unsupported-humidifier-control-test",
            model: "DR-HPF002S",
            deviceName: "Unsupported stand fan",
        } as never,
        unsupportedWebSocket as unknown as DreoWebSocketClient,
        createConstraints(),
        {
            mode: 0,
            foglevel: 3,
            rhautolevel: 60,
            rhsleeplevel: 70,
            filteron: true,
            rgbth: "30,60",
        },
    );

    await expectValidationError(
        async () => unsupportedDevice.setHumidifierMode(0),
        "Humidifier mode on another device category",
    );
    await expectValidationError(
        async () => unsupportedDevice.setHumidifierFogLevel(3),
        "Fog level on another device category",
    );
    await expectValidationError(
        async () => unsupportedDevice.setHumidifierFilterInstalled(true),
        "Filter confirmation on another device category",
    );
    await expectValidationError(
        async () =>
            unsupportedDevice.setHumidifierLowerHumidityThreshold(30),
        "Lower humidity threshold on another device category",
    );
    await expectValidationError(
        async () =>
            unsupportedDevice.setHumidifierUpperHumidityThreshold(60),
        "Upper humidity threshold on another device category",
    );

    assert.equal(
        unsupportedWebSocket.commands.length,
        0,
        "Another model must not receive humidifier commands.",
    );

    const missingStateWebSocket = new RecordingWebSocket();
    const missingStateDevice = createHumidifier(missingStateWebSocket, {
        poweron: true,
        mode: 1,
        foglevel: 3,
        rhsleeplevel: 70,
    });

    await expectValidationError(
        async () => missingStateDevice.setHumidifierAutoTargetHumidity(60),
        "Missing automatic target state",
    );
    await expectValidationError(
        async () => missingStateDevice.setHumidifierFilterInstalled(true),
        "Missing filter confirmation state",
    );

    assert.equal(
        missingStateWebSocket.commands.length,
        0,
        "Missing native states must prevent commands.",
    );
}

async function main(): Promise<void> {
    await testHumidifierModes();
    await testManualFogLevel();
    await testAutomaticTargetHumidity();
    await testSleepTargetHumidity();
    await testHhm003sSharedHumidifierSemantics();
    await testHumidityIndicatorThresholds();
    await testFilterInstalled();
    await testModelAndStateGuards();

    console.log("Native humidifier controls test successful.");
}

await main();
