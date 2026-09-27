import assert from "node:assert/strict";

import { DreoDevice } from "../packages/dreo-api/src/DreoDevice.js";
import {
    DREO_AIR_QUALITY_LEVELS,
    isDreoAirQualityLevel,
} from "../packages/dreo-api/src/models/DreoAirQualityLevel.js";
import type { Device } from "../packages/dreo-api/src/models/Device.js";
import type { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

function createDeviceDefinition(model: string): Device {
    return {
        deviceId: `${model}-air-quality-test`,
        sn: `${model}-air-quality-test-sn`,
        deviceName: `${model} air quality test`,
        brand: "DREO",
        model,
        productId: `${model}-air-quality-test-product`,
        productName: `${model} air quality test`,
        owner: true,
        shared: false,
    };
}

function createDevice(
    model: string,
    initialRawState: Record<string, unknown>
): DreoDevice {
    return new DreoDevice(
        createDeviceDefinition(model),
        {} as DreoWebSocketClient,
        new Map(),
        initialRawState
    );
}

function main(): void {
    assert.deepEqual(
        DREO_AIR_QUALITY_LEVELS,
        [1, 2, 3, 4]
    );

    for (const level of DREO_AIR_QUALITY_LEVELS) {
        assert.equal(isDreoAirQualityLevel(level), true);
    }

    for (const value of [
        0,
        5,
        1.5,
        "1",
        null,
        undefined,
        Number.NaN,
        Number.POSITIVE_INFINITY,
    ]) {
        assert.equal(
            isDreoAirQualityLevel(value),
            false,
            `Unexpected valid air-quality level: ${String(value)}`
        );
    }

    const device = createDevice(
        "DR-HAP009S",
        {
            poweron: true,
            mode: "manual",
            pm25: 8,
            aq: 2,
        }
    );

    assert.equal(device.state.airPurifierPm25, 8);
    assert.equal(
        device.state.airPurifierAirQualityLevel,
        2
    );
    assert.equal(device.state.raw.pm25, 8);
    assert.equal(device.state.raw.aq, 2);

    device.applyReport({
        pm25: 17,
    });

    assert.equal(device.state.airPurifierPm25, 17);
    assert.equal(
        device.state.airPurifierAirQualityLevel,
        2,
        "A partial PM2.5 report must preserve the last air-quality level."
    );

    device.applyReport({
        aq: 4,
    });

    assert.equal(device.state.airPurifierPm25, 17);
    assert.equal(
        device.state.airPurifierAirQualityLevel,
        4
    );

    for (const invalidPm25 of [
        -1,
        1.5,
        "17",
        Number.NaN,
        Number.POSITIVE_INFINITY,
    ]) {
        device.applyReport({
            pm25: invalidPm25,
        });

        assert.equal(
            device.state.airPurifierPm25,
            17,
            `Invalid PM2.5 value replaced the semantic state: ${
                String(invalidPm25)
            }`
        );
        assert.ok(
            Object.is(device.state.raw.pm25, invalidPm25),
            "RAW PM2.5 value must preserve the original report."
        );
    }

    for (const invalidLevel of [
        0,
        5,
        2.5,
        "4",
        null,
    ]) {
        device.applyReport({
            aq: invalidLevel,
        });

        assert.equal(
            device.state.airPurifierAirQualityLevel,
            4,
            `Invalid AQ value replaced the semantic state: ${
                String(invalidLevel)
            }`
        );
        assert.ok(
            Object.is(device.state.raw.aq, invalidLevel),
            "RAW AQ value must preserve the original report."
        );
    }

    device.applyReport({
        pm25: 0,
        aq: 1,
    });

    assert.equal(device.state.airPurifierPm25, 0);
    assert.equal(
        device.state.airPurifierAirQualityLevel,
        1
    );

    const unsupportedDevice = createDevice(
        "DR-HHM001S",
        {
            pm25: 12,
            aq: 3,
        }
    );

    assert.equal(
        unsupportedDevice.state.airPurifierPm25,
        undefined
    );
    assert.equal(
        unsupportedDevice.state.airPurifierAirQualityLevel,
        undefined
    );
    assert.equal(unsupportedDevice.state.raw.pm25, 12);
    assert.equal(unsupportedDevice.state.raw.aq, 3);

    const missingValuesDevice = createDevice(
        "DR-HAP009S",
        {
            poweron: true,
            mode: "manual",
        }
    );

    assert.equal(
        missingValuesDevice.state.airPurifierPm25,
        undefined
    );
    assert.equal(
        missingValuesDevice.state.airPurifierAirQualityLevel,
        undefined
    );

    console.log(
        "Air-purifier air-quality test successful."
    );
}

try {
    main();
} catch (error: unknown) {
    console.error(
        "Air-purifier air-quality test failed:"
    );
    console.error(error);
    process.exitCode = 1;
}
