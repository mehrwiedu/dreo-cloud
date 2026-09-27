import assert from "node:assert/strict";

import { DreoDevice } from "../packages/dreo-api/src/DreoDevice.js";
import type { Device } from "../packages/dreo-api/src/models/Device.js";
import type { DreoWebSocketClient } from "../packages/dreo-api/src/websocket/DreoWebSocketClient.js";

function createDeviceDefinition(model: string): Device {
    return {
        deviceId: `${model}-filter-life-test`,
        sn: `${model}-filter-life-test-sn`,
        deviceName: `${model} filter life test`,
        brand: "DREO",
        model,
        productId: `${model}-filter-life-test-product`,
        productName: `${model} filter life test`,
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
    const airPurifier = createDevice(
        "DR-HAP009S",
        {
            poweron: true,
            mode: "manual",
            lifetime: 87,
        }
    );

    assert.equal(
        airPurifier.state.filterLifeRemaining,
        87
    );
    assert.equal(airPurifier.state.raw.lifetime, 87);

    airPurifier.applyReport({
        filtertime: 12,
    });

    assert.equal(
        airPurifier.state.filterLifeRemaining,
        87,
        "DR-HAP009S must ignore humidifier filtertime semantics."
    );
    assert.equal(airPurifier.state.raw.filtertime, 12);

    airPurifier.applyReport({
        poweron: false,
    });

    assert.equal(
        airPurifier.state.filterLifeRemaining,
        87,
        "A partial report must preserve the last filter-life value."
    );

    airPurifier.applyReport({
        lifetime: 43,
    });

    assert.equal(
        airPurifier.state.filterLifeRemaining,
        43
    );
    assert.equal(airPurifier.state.raw.lifetime, 43);

    for (const invalidValue of [
        -1,
        101,
        1.5,
        "43",
        null,
        Number.NaN,
        Number.POSITIVE_INFINITY,
    ]) {
        airPurifier.applyReport({
            lifetime: invalidValue,
        });

        assert.equal(
            airPurifier.state.filterLifeRemaining,
            43,
            `Invalid filter-life value replaced the semantic state: ${
                String(invalidValue)
            }`
        );

        assert.ok(
            Object.is(
                airPurifier.state.raw.lifetime,
                invalidValue
            ),
            "RAW lifetime must preserve the original report."
        );
    }

    airPurifier.applyReport({
        lifetime: 0,
    });

    assert.equal(
        airPurifier.state.filterLifeRemaining,
        0
    );

    airPurifier.applyReport({
        lifetime: 100,
    });

    assert.equal(
        airPurifier.state.filterLifeRemaining,
        100
    );

    const humidifier = createDevice(
        "DR-HHM001S",
        {
            poweron: true,
            mode: 0,
            filtertime: 100,
        }
    );

    assert.equal(
        humidifier.state.filterLifeRemaining,
        100
    );
    assert.equal(humidifier.state.raw.filtertime, 100);

    humidifier.applyReport({
        filtertime: 64,
    });

    assert.equal(
        humidifier.state.filterLifeRemaining,
        64
    );

    humidifier.applyReport({
        lifetime: 22,
    });

    assert.equal(
        humidifier.state.filterLifeRemaining,
        64,
        "DR-HHM001S must ignore air-purifier lifetime semantics."
    );
    assert.equal(humidifier.state.raw.lifetime, 22);

    const unsupportedDevice = createDevice(
        "DR-HCF007S",
        {
            poweron: true,
            filtertime: 55,
        }
    );

    assert.equal(
        unsupportedDevice.state.filterLifeRemaining,
        undefined
    );
    assert.equal(
        unsupportedDevice.state.raw.filtertime,
        55
    );

    const missingValueDevice = createDevice(
        "DR-HAP009S",
        {
            poweron: true,
            mode: "manual",
        }
    );

    assert.equal(
        missingValueDevice.state.filterLifeRemaining,
        undefined
    );

    console.log(
        "Shared filter-life remaining test successful."
    );
}

try {
    main();
} catch (error: unknown) {
    console.error(
        "Shared filter-life remaining test failed:"
    );
    console.error(error);
    process.exitCode = 1;
}
