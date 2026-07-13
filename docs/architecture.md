# Architecture

The DREO SDK is designed as a reusable TypeScript library for communicating with DREO smart home devices.

The architecture separates authentication, REST communication, WebSocket communication, device state management and command mapping into independent components. This keeps the SDK modular, easy to maintain and reusable for future integrations.

---

# High Level Architecture

```text
                   Application
                        │
                        ▼
                  DreoClient
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
   DreoSession      REST API       WebSocket Client
        │               │                ▲
        ▼               ▼                │
   AuthManager   AuthenticatedHttpClient │
        │               │                │
        └───────────────┴──── Session Observer
                                        │
                                        ▼
                                   DreoDevice
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
           StateMapper                                 DreoDeviceState
```

---

# Core Components

## AuthManager

Responsible for authenticating against the DREO cloud.

Responsibilities

-   Login
-   Token handling
-   Token refresh
-   Region detection

---

````md
## DreoSession

`DreoSession` is the central authentication state holder.

Responsibilities

-   Store the current access token

-   Trigger login if no token exists

-   Refresh the session after authentication failures

-   Notify registered observers after session changes

-   Provide the current session data to HTTP and WebSocket components

The session is intentionally shared by REST communication and the WebSocket client.

This allows the SDK to handle an expired or invalid access token consistently.

When the HTTP layer receives a 401 response, it calls `DreoSession.refresh()`.

After a successful refresh, the session notifies its observers.

The WebSocket client uses this notification to reconnect with the new access token.

## REST API

Provides access to the HTTP endpoints used by the official application.

Responsibilities

-   Device discovery
-   User information
-   Device metadata

---

## DreoWebSocketClient

Maintains the persistent WebSocket connection to the DREO cloud.

Responsibilities

-   Connect to the cloud
-   Send control commands
-   Receive reports
-   Dispatch incoming messages
-   Support single-parameter commands
-   Support multi-parameter commands
-   Reconnect automatically after a refreshed session
-   Avoid duplicate connections
-   Handle disconnect during connection setup
-   Support report handler unsubscribe

Supported message types

-   report
-   control-report
-   control-reply

---

## DreoClient

Main entry point of the SDK.

Responsibilities

-   Authenticate
-   Discover devices
-   Create DreoDevice instances
-   Manage WebSocket connection
-   Route incoming reports

Typical usage

```ts
const client = new DreoClient(config);

await client.login();

await client.loadDevices();

const device = client.getDeviceByName("Living Room");
```
````

---

## DreoLogger

The SDK uses a central optional logger interface called `DreoLogger`.

The logger can be passed through `DreoClient.login()`:

````ts
const client = await DreoClient.login({
    email,
    password,
    region: "EU",
    logger,
});

The logger is forwarded to:

* AuthManager
* AuthenticatedHttpClient
* DreoWebSocketClient

If no logger is provided, the SDK remains silent.

The production SDK code does not write directly to console.*.
Console output is limited to development and research tools under tools/.

## DreoDevice

Represents one physical DREO device.

Responsibilities

-   Store device metadata
-   Maintain local device state
-   Apply incoming reports
-   Expose high-level control methods

Example

```ts
await device.setFan(true);

await device.setWindLevel(4);

await device.setMainLight(true);

await device.setBrightness(50);

await device.setColorTemperature(60);

await device.setAtmosphereLight(true);
````

---

## StateMapper

The StateMapper converts high-level SDK operations into the parameter combinations expected by DREO devices.

Example

```ts
device.setBrightness(50);
```

becomes

```json
{
    "poweron": true,
    "lighton": true,
    "brightness": 50
}
```

Another example

```ts
device.setWindLevel(4);
```

becomes

```json
{
    "poweron": true,
    "fanon": true,
    "windlevel": 4
}
```

The goal of the StateMapper is to hide DREO protocol quirks from SDK users.

---

# Device State

The DREO protocol sends incremental updates.

Example

```json
{
    "brightness": 50
}
```

Only the modified value is transmitted.

The SDK therefore maintains a local cached state for every device.

Incoming reports are merged into the existing state.

Example

```ts
device.applyReport(report.reported);
```

Unknown protocol fields are preserved inside

```ts
state.raw;
```

This allows newly discovered protocol values to remain available before official SDK support is implemented.

---

# Command Flow

```text
Application
      │
      ▼
DreoDevice
      │
      ▼
StateMapper
      │
      ▼
WebSocket Client
      │
      ▼
DREO Cloud
      │
      ▼
Physical Device
      │
      ▼
WebSocket Report
      │
      ▼
applyReport()
      │
      ▼
Updated Device State
```

---

# Design Principles

The SDK follows several important design principles.

-   Separate protocol handling from business logic.
-   Hide DREO protocol quirks behind high-level methods.
-   Keep a local synchronized device state.
-   Preserve unknown protocol values.
-   Prefer reusable SDK logic over adapter-specific implementations.
-   Keep the future ioBroker adapter as small as possible.

---

# Current Status

Implemented

-   Authentication
-   Device discovery
-   WebSocket communication
-   Local state cache
-   Multi-parameter commands
-   StateMapper
-   Main light
-   Brightness
-   Color temperature
-   Fan
-   Wind level
-   Atmosphere light (RGB On/Off)
-   Session refresh after HTTP 401
-   WebSocket reconnect after session refresh
-   Central SDK logger
-   WebSocket lifecycle hardening

Currently under investigation

-   RGB presets
-   RGB scenes
-   Additional lighting effects
-   Timer
-   Sleep mode
-   Oscillation
-   Additional device models

---

# Future Architecture

The long-term goal is that integrations such as the ioBroker adapter communicate exclusively with the SDK.

Example

```ts
await device.setFan(true);

await device.setWindLevel(4);

await device.setBrightness(50);

await device.setAtmosphereLight(false);
```

The adapter itself should only be responsible for

-   creating ioBroker states
-   reacting to state changes
-   synchronizing SDK state with ioBroker

All protocol knowledge should remain inside the SDK.

## Error Model

The SDK uses a dedicated error hierarchy instead of generic JavaScript errors.

```
DreoError
├── DreoValidationError
├── DreoAuthenticationError
└── DreoWebSocketError
```

This allows SDK consumers to distinguish between validation, authentication and communication failures using standard `instanceof` checks.
