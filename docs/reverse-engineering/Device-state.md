# Device State

**Status:** Verified with multiple Dreo fan devices.

## Endpoint

    GET /api/user-device/device/state

## Query Parameters

-   `deviceSn`: Dreo device serial number

## Purpose

Returns the current runtime state of a single Dreo device.

## Response Structure

    data
    └── mixed
        ├── connected
        ├── poweron
        ├── mode
        ├── windlevel
        ├── muteon
        ├── childlockon
        ├── lighton
        ├── timeron
        ├── timeroff
        └── ...

## Observations

-   The endpoint returns the current state of exactly one device.
-   The endpoint must be called separately for every device.
-   Every state entry contains:
    -   `state`
    -   `timestamp`
-   Not every device supports every state.
-   Missing properties are expected and depend on the device type.

## Verified States

| API Key                 | Meaning                                  |
| ----------------------- | ---------------------------------------- |
| connected               | Device online                            |
| poweron                 | Power state                              |
| mode                    | Current operating mode                   |
| windlevel               | Current fan speed                        |
| muteon                  | Beep enabled/disabled                    |
| childlockon             | Child lock (tower/stand/table fans only) |
| lighton                 | Display light                            |
| timeron                 | Timer configuration                      |
| timeroff                | Timer configuration                      |
| wifi_rssi               | Wi-Fi signal strength                    |
| network_latency         | Cloud latency                            |
| wifi_ssid               | Connected Wi-Fi                          |
| module_firmware_version | Module firmware                          |
| mcu_version             | MCU firmware                             |
| module_hardware_model   | Hardware model                           |

## Device-specific States

Some state fields are only available on certain device families.

Example:

-   Tower fan → `childlockon`
-   Ceiling fan → no `childlockon`

Missing fields must not be treated as errors.

## SDK Decision

The SDK shall not expose the raw API response.

Instead, the response will be mapped into a dedicated `DeviceState` domain model.

Planned properties:

-   connected
-   power
-   mode
-   windLevel
-   mute
-   childLock?
-   light?
-   timerOn?
-   timerOff?

Additional device-specific properties may be added later.

### Resolver Strategy

The Device State endpoint has proven to be the most reliable source for discovering
the runtime capabilities of a device.

Observed during reverse engineering:

-   FamilyTree metadata (`controlsConf`) may be incomplete or even empty.
-   The Device State endpoint returns the currently available state keys of the device.
-   Different device families expose different state sets.
-   Unknown state keys must not be discarded.

SDK architecture decision:

1. FamilyTree metadata is treated as supplemental information.
2. The Device State endpoint is the primary source for runtime state discovery.
3. WebSocket reports update existing states after initialization.
4. A model-specific fallback database may supplement missing information for known devices.

The SDK therefore follows a "Device Resolver" approach instead of a static capability engine.

Future work:

The Device Resolver will merge information from:

-   FamilyTree metadata
-   Initial Device State
-   WebSocket reports
-   Optional model-specific fallback definitions

to determine the complete set of available SDK states for a device.

## ioBroker

The ioBroker adapter should only create states for capabilities that are supported by the current device.

## Investigation Notes

### 2026-06-29 – Ceiling Fan Light State

**Status:** Confirmed by testing

During testing with three identical Dreo ceiling fans (`DR-HCF007S`), the SDK reported:

    light = true

for one device although the main light was switched off.

Further investigation showed:

-   The main light state was correctly displayed inside the Dreo app.
-   The state was **not** outdated.
-   The only difference between the three ceiling fans was the configured RGB effect.

Results:

-   Ceiling Fan A

    -   RGB Effect: "Breathing"
    -   SDK: `light = true`

-   Ceiling Fan B

    -   RGB Effect: Static
    -   SDK: `light = false`

-   Ceiling Fan C
    -   RGB Effect: Static
    -   SDK: `light = false`

Changing the RGB effect of Ceiling Fan A from **Breathing** to **Static** immediately changed the SDK output from:

    light = true

to

    light = false

without changing the main light state.

### Conclusion

The API field

    mixed.lighton.state

does **not** appear to represent the main ceiling light.

It is likely related to the RGB lighting subsystem or an active lighting effect.

The actual main light state is expected to be exposed by another API field or endpoint and still has to be identified.

### SDK Decision

Do **not** expose `mixed.lighton.state` as "Main Light".

Until the actual meaning has been fully verified, this field should be treated as an internal lighting-related state.‚

## 2026-06-29 – Ceiling Fan Component State Freshness

**Status:** Verified by testing with DR-HCF007S ceiling fan.

For ceiling fans, `poweron` behaves as a reliable aggregate state.

Observed behavior:

-   `poweron = true` if at least one component is active:
    -   fan
    -   main light
    -   RGB / ambience light
-   `poweron = false` if all components are off.

Component states such as:

-   `fanon`
-   `lighton`
-   `atmon`

do not always update when only the same component is toggled repeatedly.

They may retain the previous value until another component is switched.

Conclusion:

-   `poweron` can be used as aggregate device power state.
-   `fanon`, `lighton` and `atmon` must be treated carefully.
-   Their timestamps should be evaluated before using them as reliable component states.
-   For ioBroker, component states should initially be marked as potentially stale for ceiling fans.
