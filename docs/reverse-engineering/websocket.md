# WebSocket Transport

**Status:** Verified against the implemented DREO Cloud WebSocket communication.

## Purpose

The DREO Cloud communication uses a WebSocket connection for:

-   sending commands
-   receiving live device updates
-   keeping device states current after user actions

HTTP endpoints such as `device/state` appear to provide snapshot/startup state data, while WebSocket updates are required for live state synchronization.

## WebSocket URL

    wss://wsb-{region}.dreo-tech.com/websocket?accessToken={accessToken}&timestamp={timestamp}

Example region:

    eu

## Keepalive

The WebSocket sends a ping message periodically.

Observed ping message:

    2

Observed interval:

    15 seconds

## Command Format

Commands are sent as JSON over WebSocket.

General structure:

    {
      "devicesn": "<device serial number>",
      "method": "control",
      "params": {
        "<commandKey>": <value>
      },
      "timestamp": 1234567890
    }

## Example Commands

### Main light on

    {
      "devicesn": "<device serial number>",
      "method": "control",
      "params": {
        "lighton": true
      },
      "timestamp": 1234567890
    }

### Fan on

    {
      "devicesn": "<device serial number>",
      "method": "control",
      "params": {
        "fanon": true
      },
      "timestamp": 1234567890
    }

### Atmosphere / RGB light on

    {
      "devicesn": "<device serial number>",
      "method": "control",
      "params": {
        "atmon": true
      },
      "timestamp": 1234567890
    }

## Known Command Keys

-   `poweron`
-   `fanon`
-   `lighton`
-   `atmon`
-   `atmbri`
-   `brightness`
-   `colortemp`
-   `mode`
-   `windlevel`
-   `muteon`
-   `childlockon`
-   `rgbpresetnum`
-   `rgbpresetsel`
-   `rgbeffectid`

## Important Findings

-   `fanon` is used for the fan rotor.
-   `lighton` is used for the main light.
-   `atmon` is used for atmosphere / RGB light.
-   `atmbri` is used for atmosphere / RGB brightness.
-   `poweron` appears to be an aggregate device power state.
-   Commands are not sent through the HTTP `device/state` endpoint.
-   Commands are sent through WebSocket using method `control`.

## SDK Decision

The SDK should implement a dedicated WebSocket transport.

Planned class:

    DreoWebSocketClient

Planned responsibilities:

-   connect to the Dreo WebSocket endpoint
-   authenticate with access token
-   send keepalive pings
-   send device commands
-   receive live server updates
-   expose updates to higher-level SDK classes

## Adapter Implication

The ioBroker adapter should not rely on HTTP polling alone.

Recommended architecture:

    HTTP startup sync
      → family tree
      → initial device states

    WebSocket live sync
      → commands
      → live updates
      → state corrections

This is required for reliable device state handling, especially for multi-component devices such as ceiling fans.

# WebSocket Notes (2026-07-03)

## Message Types

The DREO WebSocket API currently uses at least two different message types related to state changes:

-   `control-reply`
-   `report`

### control-reply

A `control-reply` confirms that the cloud accepted the requested command.

Example:

```
SDK -> muteon = true
Cloud -> control-reply
```

This message **does not necessarily indicate** that the device has already applied the requested state.

---

### report

A `report` represents the actual device state.

The SDK should treat this message as the authoritative source of truth and update the internal device state accordingly.

---

## Automatic Device Routing

Incoming reports are automatically routed to the corresponding `DreoDevice` instance by matching the `devicesn`.

Flow:

```
WebSocket
    ↓
report
    ↓
DreoClient
    ↓
Device Registry
    ↓
DreoDevice.applyReport()
```

This allows every device instance to keep its own state synchronized automatically.

---

## Global WebSocket Behaviour

The WebSocket is **not limited** to the device currently being controlled.

During a 15-minute monitoring session, reports from other devices were received without sending any commands.

Example:

-   Bedroom ceiling fan
-   RSSI report

Conclusion:

The WebSocket operates on the account level and delivers asynchronous events for all registered devices.

---

## Monitoring Mode

A dedicated monitoring test was created.

Behaviour:

-   Connect to the WebSocket
-   Do not send commands
-   Log all incoming reports
-   Keep the connection open for 15 minutes

This monitoring mode is useful for discovering undocumented states and background events.

---

## Observations

-   Reports arrive asynchronously.
-   Different devices report independently.
-   RSSI values are transmitted periodically.
-   Additional telemetry is expected.

---

## WebSocket Disconnect

`disconnect()` currently closes the WebSocket asynchronously.

The Node.js process exits only after the underlying `close` event has completed.

Future improvement:

```ts
await websocket.disconnect();
```

---

---

## WebSocket Session Refresh and Reconnect

The WebSocket client is connected to the central `DreoSession` through an observer mechanism.

When an authenticated HTTP request receives `HTTP 401`, the `AuthenticatedHttpClient` triggers a session refresh.

Flow:

    HTTP request
        ↓
    HTTP 401
        ↓
    DreoSession.refresh()
        ↓
    AuthManager.login()
        ↓
    DreoSessionObserver notification
        ↓
    DreoWebSocketClient reconnect
        ↓
    New WebSocket connection with refreshed access token

The WebSocket client is intentionally not coupled directly to the HTTP client.

The HTTP client only refreshes the session.

The WebSocket client only observes session changes.

This keeps the architecture modular and avoids cross-dependencies between HTTP and WebSocket layers.

---

## WebSocket Lifecycle Behaviour

The WebSocket client was hardened for SDK and adapter use.

Verified behaviour:

-   Calling `connect()` while already connected does not create a second socket.
-   Calling `connect()` while a connection is already pending reuses the pending connection.
-   Calling `disconnect()` while the socket is still connecting does not leave the connection promise hanging.
-   Pending command replies are rejected during disconnect or reconnect.
-   Report handlers can be unsubscribed.
-   Repeated `sync()` calls do not create duplicate report handlers.

This is important for future ioBroker adapter lifecycle events, where connect, reconnect, stop and restart operations may happen close together.

---

## WebSocket Logging

The WebSocket client does not write directly to `console.*`.

Logging is optional and uses the shared SDK logger interface `DreoLogger`.

The logger supports these optional methods:

-   `debug(message, data)`
-   `info(message, data)`
-   `warn(message, data)`
-   `error(message, data)`

If no logger is passed, the WebSocket client remains silent.

When a logger is passed through `DreoClient.login({ logger })`, WebSocket connection and reconnect events are logged through that logger.

Example usage:

    const client = await DreoClient.login({
        email,
        password,
        region: "EU",
        logger,
    });

## Next Development Step

Implement the first production lighting command.

Target device:

-   Living Room Ceiling Fan

Function:

```ts
setAtmosphereLight(enabled: boolean)
```

DREO state key:

```
atmon
```

Future commands:

-   `lighton`
-   `brightness`
-   `colorTemperature`
-   `fanon`
-   `windlevel`

# Power State Behaviour

## Summary

The ceiling fan does **not** use `poweron` as a simple "device on/off" state.

Instead, `poweron` acts as a **global master power** while the individual component states (`fanon`, `lighton`, `atmon`) remain logically independent.

The WebSocket protocol sends **delta updates only**. Therefore, only changed states are reported.

---

## Verified States

| State     | Description                 |
| --------- | --------------------------- |
| `poweron` | Global master power         |
| `fanon`   | Fan motor enabled           |
| `lighton` | Main light enabled          |
| `atmon`   | Ambient / RGB light enabled |

---

## Verified Behaviour

### Global Power ON

When the device is switched on using the global power button:

```
poweron = true
```

the following rule was always observed:

```
lighton = true
```

The main light is always enabled.

---

### Global Power OFF

When the device is switched off using the global power button:

```
poweron = false
```

the following rule was always observed:

```
lighton = false
```

The main light is always disabled.

---

### Fan and Ambient Light

Unlike the main light, the states

```
fanon
```

and

```
atmon
```

are **not directly derived** from `poweron`.

When

```
poweron = false
```

both states may internally still represent either

```
true
```

or

```
false
```

depending on the device state before power off.

---

## Resume Behaviour

The global power button behaves like a **resume function**.

Observed examples:

| State before `poweron = false` | After `poweron = true` |
| ------------------------------ | ---------------------- |
| Main light                     | Main light             |
| Main light + Fan               | Main light + Fan       |
| Main light + RGB               | Main light + RGB       |
| Main light + Fan + RGB         | Main light + Fan + RGB |

If only the main light was active before power off, only the main light is restored.

---

## Component Activation

Enabling a single component after a global power off **does not restore** previously active components.

Example:

Initial state

```
Main Light = ON
Fan = ON
RGB = ON
```

↓

Global power off

```
poweron = false
```

↓

Only the main light is enabled

```
lighton = true
```

↓

Observed result

```
poweron = true
lighton = true
fanon = false
atmon = false
```

The device leaves the previous resume state and switches to the newly requested component state.

---

## Protocol Behaviour

The WebSocket protocol sends **state deltas only**.

Examples:

```json
{
    "atmon": true
}
```

```json
{
    "lighton": false
}
```

```json
{
    "fanon": true
}
```

A complete device state is **not** transmitted with every report.

The SDK therefore has to keep an internal state cache and apply every incoming delta update.

### Observed Resume Behaviour

`poweron` behaves as a global standby switch.

The device internally remembers which components were active before entering
standby.

Examples:

-   Fan ON → `poweron=false` → `poweron=true` → Fan resumes.
-   RGB ON → `poweron=false` → `poweron=true` → RGB resumes.
-   Main light ON → `poweron=false` → `poweron=true` → Main light resumes.

If a component is explicitly changed while the device is running again,
the remembered resume state is updated accordingly.

# State Cache and Delta Processing

## Summary

The DREO WebSocket protocol does **not** transmit the complete device state with every message.

Instead, both `report` and `control-report` contain **delta updates only**.

The SDK therefore maintains an internal device state and applies every incoming delta to this cached state.

---

## Verified Behaviour

Example:

Initial state

```text
poweron = true
fanon = false
lighton = false
atmon = true
rgbpresetsel = 2
rgbeffectid = 1720000000000004002
```

Incoming report

```json
{
    "rgbpresetsel": 3
}
```

Resulting SDK state

```text
poweron = true
fanon = false
lighton = false
atmon = true
rgbpresetsel = 3
rgbeffectid = 1720000000000004002
```

Only the changed value is updated.

---

Another incoming report

```json
{
    "rgbeffectid": "1720000000000004003"
}
```

Resulting SDK state

```text
poweron = true
fanon = false
lighton = false
atmon = true
rgbpresetsel = 3
rgbeffectid = 1720000000000004003
```

Again, only the changed property is updated.

---

## SDK Architecture

Every `DreoDevice` owns its own cached `DreoDeviceState`.

Incoming WebSocket messages are processed using

```text
device.applyReport(reported)
```

The SDK updates only the properties contained in the incoming report while preserving all previously known values.

Unknown properties are preserved inside

```text
state.raw
```

to guarantee forward compatibility with newly discovered protocol fields.

---

## Benefits

-   Supports delta-based WebSocket messages.
-   Always exposes a complete device state.
-   Unknown protocol fields are never lost.
-   New states can be added by extending `applyReport()`.
-   Provides a stable foundation for the ioBroker adapter.

## Protocol Rule 001 – Compound Control Payloads

The DREO ceiling fan does not reliably accept isolated control commands for all
components.

For example, the atmosphere light (RGB) cannot be enabled by sending only:

```json
{
    "atmon": true
}
```

Instead, the application sends a complete target state:

```json
{
    "poweron": true,
    "atmon": true,
    "lighton": false
}
```

Likewise, disabling the atmosphere light requires:

```json
{
    "poweron": false,
    "atmon": false,
    "lighton": false
}
```

Conclusion:

-   Treat WebSocket control payloads as complete target states.
-   Prefer a single compound `control` command over multiple sequential commands.
-   This behavior is the foundation for the SDK State Mapper.

## Compound Control Payloads

During protocol analysis it turned out that the ceiling fan does not always accept
isolated state changes.

For example, enabling the RGB atmosphere light with

```json
{
    "atmon": true
}
```

does not switch the light on if the whole device is currently powered off.

Instead, the device expects the global power state to be restored first.

Working payload:

```json
{
    "poweron": true,
    "atmon": true
}
```

This enables the RGB light without affecting the current state of the main light.

When disabling the RGB light, only the atmosphere light state should be sent:

```json
{
    "atmon": false
}
```

Sending

```json
{
    "poweron": false
}
```

would switch the complete device into its global standby state and therefore must
not be used for disabling individual components.

Current recommendation:

| Action  | Payload                              |
| ------- | ------------------------------------ |
| RGB ON  | `{ "poweron": true, "atmon": true }` |
| RGB OFF | `{ "atmon": false }`                 |

The missing parameters are preserved by the device and therefore should not be
sent unless they intentionally need to change.

## Verified Ceiling Fan Controls

The following controls were verified successfully through the SDK:

| Function          | SDK Method              | DREO Keys                          | Result                       |
| ----------------- | ----------------------- | ---------------------------------- | ---------------------------- |
| Main light on/off | `setMainLight()`        | `poweron`, `lighton`               | Working                      |
| Brightness        | `setBrightness()`       | `brightness`, `poweron`, `lighton` | Working                      |
| Color temperature | `setColorTemperature()` | `colortemp`, `poweron`, `lighton`  | Working                      |
| Fan on/off        | `setFan()`              | `poweron`, `fanon`                 | Working                      |
| Wind level        | `setWindLevel()`        | `windlevel`, `poweron`, `fanon`    | Working                      |
| RGB on/off        | `setAtmosphereLight()`  | `poweron`, `atmon`                 | Working                      |
| Global power      | `setPower()`            | `poweron`                          | Working with resume behavior |

RGB presets are not verified yet and require further protocol analysis.
