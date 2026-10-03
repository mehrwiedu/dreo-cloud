import { deepEqual, equal, notEqual, ok } from "node:assert/strict";

import { DreoDevice } from "../packages/dreo-api/src/DreoDevice.js";
import type { Device } from "../packages/dreo-api/src/models/Device.js";
import type { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

const MODEL = "DR-HCF007S";

class RecordingWebSocket {
    public readonly commands: Record<string, unknown>[] = [];

    public async sendCommandParams(
        deviceSn: string,
        params: Record<string, unknown>
    ): Promise<{
        method: string;
        devicesn: string;
        reported: Record<string, unknown>;
    }> {
        this.commands.push({ ...params });

        return {
            method: "control-reply",
            devicesn: deviceSn,
            reported: { ...params },
        };
    }
}

function createDevice(
    initialRawState: Record<string, unknown>
): {
    device: DreoDevice;
    websocket: RecordingWebSocket;
} {
    const websocket = new RecordingWebSocket();

    const definition: Device = {
        deviceId: "hcf007s-power-mask-test",
        sn: "hcf007s-power-mask-test-sn",
        deviceName: "HCF007S power-mask test",
        brand: "DREO",
        model: MODEL,
        productId: "hcf007s-power-mask-test-product",
        productName: "Ceiling Fan",
        owner: true,
        shared: false,
    };

    const device = new DreoDevice(
        definition,
        websocket as unknown as DreoWebSocketClient,
        new Map(),
        initialRawState
    );

    return {
        device,
        websocket,
    };
}

function lastCommand(
    websocket: RecordingWebSocket
): Record<string, unknown> {
    const command = websocket.commands[websocket.commands.length - 1];

    ok(command, "Expected a WebSocket command.");

    return command;
}

async function testPowerResumePreservesMask(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: false,
        fanon: false,
        lighton: true,
        atmon: false,
        windlevel: 8,
        brightness: 50,
        colortemp: 60,
    });

    await device.setPower(true);

    deepEqual(lastCommand(websocket), {
        poweron: true,
    });

    equal(device.state.raw.fanon, false);
    equal(device.state.raw.lighton, true);
    equal(device.state.raw.atmon, false);
    equal(device.state.raw.windlevel, 8);
    equal(device.state.raw.brightness, 50);
    equal(device.state.raw.colortemp, 60);
}

async function testPowerOnRecoversImpossibleEmptyMask(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: false,
        fanon: false,
        lighton: false,
        atmon: false,
        windlevel: 6,
        brightness: 92,
        colortemp: 40,
    });

    await device.setPower(true);

    deepEqual(lastCommand(websocket), {
        poweron: true,
        fanon: true,
        lighton: true,
        atmon: true,
    });

    equal(device.state.raw.windlevel, 6);
    equal(device.state.raw.brightness, 92);
    equal(device.state.raw.colortemp, 40);
}

async function testDirectFanActivationWhilePoweredOffIsExclusive(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: false,
        fanon: false,
        lighton: true,
        atmon: true,
        windlevel: 6,
        brightness: 31,
        colortemp: 55,
    });

    await device.setFan(true);

    deepEqual(lastCommand(websocket), {
        poweron: true,
        fanon: true,
        lighton: false,
        atmon: false,
    });

    equal(device.state.raw.windlevel, 6);
    equal(device.state.raw.brightness, 31);
    equal(device.state.raw.colortemp, 55);
}

async function testDirectMainLightActivationWhilePoweredOffIsExclusive(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: false,
        fanon: true,
        lighton: false,
        atmon: true,
        windlevel: 8,
        brightness: 40,
        colortemp: 65,
    });

    await device.setMainLight(true);

    deepEqual(lastCommand(websocket), {
        poweron: true,
        fanon: false,
        lighton: true,
        atmon: false,
    });

    equal(device.state.raw.windlevel, 8);
    equal(device.state.raw.brightness, 40);
    equal(device.state.raw.colortemp, 65);
}

async function testDirectAtmosphereActivationWhilePoweredOffIsExclusive(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: false,
        fanon: true,
        lighton: true,
        atmon: false,
        windlevel: 4,
        brightness: 70,
    });

    await device.setAtmosphereLight(true);

    deepEqual(lastCommand(websocket), {
        poweron: true,
        fanon: false,
        lighton: false,
        atmon: true,
    });

    equal(device.state.raw.windlevel, 4);
    equal(device.state.raw.brightness, 70);
}

async function testActivationWhilePoweredOnIsAdditive(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: true,
        fanon: false,
        lighton: true,
        atmon: true,
    });

    await device.setFan(true);

    const command = lastCommand(websocket);

    equal(command.fanon, true);
    notEqual(command.lighton, false);
    notEqual(command.atmon, false);
}

async function testTurningOffOneOfSeveralFunctionsOnlyClearsTarget(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: true,
        fanon: true,
        lighton: true,
        atmon: false,
    });

    await device.setMainLight(false);

    deepEqual(lastCommand(websocket), {
        lighton: false,
    });
}

async function testTurningOffLastFunctionPreservesStoredMask(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: true,
        fanon: false,
        lighton: true,
        atmon: false,
        brightness: 50,
        colortemp: 65,
    });

    await device.setMainLight(false);

    deepEqual(lastCommand(websocket), {
        poweron: false,
    });

    equal(device.state.raw.lighton, true);
    equal(device.state.raw.brightness, 50);
    equal(device.state.raw.colortemp, 65);
}

async function testTurningOffFriendlyFunctionWhilePowerIsAlreadyOffPreservesMask(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: false,
        fanon: false,
        lighton: true,
        atmon: false,
        brightness: 50,
    });

    await device.setMainLight(false);

    deepEqual(lastCommand(websocket), {
        poweron: false,
    });

    equal(device.state.raw.lighton, true);
    equal(device.state.raw.brightness, 50);
}

async function testWindLevelActivationUsesFanMaskSemantics(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: false,
        fanon: false,
        lighton: true,
        atmon: true,
        windlevel: 6,
        brightness: 31,
    });

    await device.setWindLevel(8);

    deepEqual(lastCommand(websocket), {
        windlevel: 8,
        poweron: true,
        fanon: true,
        lighton: false,
        atmon: false,
    });

    equal(device.state.raw.brightness, 31);
}

async function testBrightnessActivationUsesMainLightMaskSemantics(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: false,
        fanon: true,
        lighton: false,
        atmon: true,
        windlevel: 8,
        brightness: 40,
        colortemp: 65,
    });

    await device.setBrightness(50);

    deepEqual(lastCommand(websocket), {
        brightness: 50,
        poweron: true,
        fanon: false,
        lighton: true,
        atmon: false,
    });

    equal(device.state.raw.windlevel, 8);
    equal(device.state.raw.colortemp, 65);
}

async function testColorTemperatureUsesMainLightMaskSemantics(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: false,
        fanon: true,
        lighton: false,
        atmon: true,
        brightness: 50,
        colortemp: 65,
    });

    await device.setColorTemperature(70);

    deepEqual(lastCommand(websocket), {
        colortemp: 70,
        poweron: true,
        fanon: false,
        lighton: true,
        atmon: false,
    });

    equal(device.state.raw.brightness, 50);
}


async function testRgbPresetActivationUsesAtmosphereMaskSemantics(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: false,
        fanon: true,
        lighton: true,
        atmon: false,
        windlevel: 8,
        brightness: 60,
    });

    await device.setRgbPreset(3);

    deepEqual(lastCommand(websocket), {
        rgbpresetsel: 3,
        poweron: true,
        fanon: false,
        lighton: false,
        atmon: true,
    });

    equal(device.state.raw.windlevel, 8);
    equal(device.state.raw.brightness, 60);
}

async function testAtmosphereBrightnessActivationUsesAtmosphereMaskSemantics(): Promise<void> {
    const { device, websocket } = createDevice({
        poweron: false,
        fanon: true,
        lighton: true,
        atmon: false,
        windlevel: 8,
        brightness: 60,
        atmbri: 35,
    });

    await device.setAtmosphereBrightness(45);

    deepEqual(lastCommand(websocket), {
        atmbri: 45,
        poweron: true,
        fanon: false,
        lighton: false,
        atmon: true,
    });

    equal(device.state.raw.windlevel, 8);
    equal(device.state.raw.brightness, 60);
}

async function main(): Promise<void> {
    await testPowerResumePreservesMask();
    await testPowerOnRecoversImpossibleEmptyMask();
    await testDirectFanActivationWhilePoweredOffIsExclusive();
    await testDirectMainLightActivationWhilePoweredOffIsExclusive();
    await testDirectAtmosphereActivationWhilePoweredOffIsExclusive();
    await testActivationWhilePoweredOnIsAdditive();
    await testTurningOffOneOfSeveralFunctionsOnlyClearsTarget();
    await testTurningOffLastFunctionPreservesStoredMask();
    await testTurningOffFriendlyFunctionWhilePowerIsAlreadyOffPreservesMask();
    await testWindLevelActivationUsesFanMaskSemantics();
    await testBrightnessActivationUsesMainLightMaskSemantics();
    await testColorTemperatureUsesMainLightMaskSemantics();
    await testRgbPresetActivationUsesAtmosphereMaskSemantics();
    await testAtmosphereBrightnessActivationUsesAtmosphereMaskSemantics();

    console.log("HCF007S power-mask regression test successful.");
}

main().catch((error: unknown) => {
    console.error("HCF007S power-mask regression test failed:");
    console.error(error);
    process.exitCode = 1;
});
