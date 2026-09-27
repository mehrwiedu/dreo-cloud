import assert from "node:assert/strict";

import { StateMapper } from "../packages/dreo-api/src/StateMapper.js";
import type { DreoDeviceState } from "../packages/dreo-api/src/models/DreoDeviceState.js";

function createState(
    raw: Record<string, unknown>,
): DreoDeviceState {
    return {
        raw,
    };
}

function assertPayload(
    description: string,
    actual: Record<string, unknown>,
    expected: Record<string, unknown>,
): void {
    assert.deepEqual(
        actual,
        expected,
        `${description}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`,
    );

    console.log(`PASS: ${description}`);
}

function main(): void {
    const mapper = new StateMapper();

    assertPayload(
        "Fan on includes poweron when the device supports poweron",
        mapper.build(
            createState({
                poweron: false,
                fanon: false,
                lighton: false,
            }),
            {
                fan: true,
            },
        ),
        {
            poweron: true,
            fanon: true,
        },
    );

    assertPayload(
        "Fan on omits poweron when the device does not support poweron",
        mapper.build(
            createState({
                fanon: false,
                lighton: false,
            }),
            {
                fan: true,
            },
        ),
        {
            fanon: true,
        },
    );

    assertPayload(
        "Wind level includes poweron when the device supports poweron",
        mapper.build(
            createState({
                poweron: false,
                fanon: false,
                lighton: false,
            }),
            {
                windLevel: 5,
            },
        ),
        {
            windlevel: 5,
            poweron: true,
            fanon: true,
        },
    );

    assertPayload(
        "Wind level omits poweron when the device does not support poweron",
        mapper.build(
            createState({
                fanon: false,
                lighton: false,
            }),
            {
                windLevel: 5,
            },
        ),
        {
            windlevel: 5,
            fanon: true,
        },
    );

    assertPayload(
        "Brightness includes poweron when the device supports poweron",
        mapper.build(
            createState({
                poweron: false,
                lighton: false,
                fanon: false,
            }),
            {
                brightness: 40,
            },
        ),
        {
            brightness: 40,
            poweron: true,
            lighton: true,
        },
    );

    assertPayload(
        "Brightness omits poweron when the device does not support poweron",
        mapper.build(
            createState({
                lighton: false,
                fanon: false,
            }),
            {
                brightness: 40,
            },
        ),
        {
            brightness: 40,
            lighton: true,
        },
    );

    assertPayload(
        "Fan off includes poweron=false when supported and no scoped function remains enabled",
        mapper.build(
            createState({
                poweron: true,
                fanon: true,
                lighton: false,
                atmon: false,
            }),
            {
                fan: false,
            },
        ),
        {
            fanon: false,
            poweron: false,
        },
    );

    assertPayload(
        "Fan off omits poweron when the device does not support poweron",
        mapper.build(
            createState({
                fanon: true,
                lighton: false,
            }),
            {
                fan: false,
            },
        ),
        {
            fanon: false,
        },
    );

    console.log("");
    console.log("Optional poweron StateMapper test successful.");
}

main();
