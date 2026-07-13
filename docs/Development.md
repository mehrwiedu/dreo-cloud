# Development Guidelines

This document defines the development workflow for the DREO SDK.

Following these guidelines keeps the project consistent, easy to review and easy to maintain.

---

# General Principles

-   Keep the SDK clean and reusable.
-   Hide DREO protocol details behind high-level APIs.
-   Prefer readability over clever code.
-   Every feature should be verified on a real device whenever possible.
-   Document new protocol discoveries immediately.

---

# Development Workflow

The preferred workflow is:

1. Plan the change.
2. Modify only one file at a time.
3. Compile the project.
4. Fix all compiler errors.
5. Test against a real DREO device.
6. Update the documentation.
7. Commit the change.

---

# File Changes

To reduce mistakes during development:

-   Change only one file at a time.
-   Always replace the complete file instead of editing fragments.
-   Compile after every file change.
-   Do not continue until the project builds successfully.

---

# Testing

Every new feature should be verified using the development monitor.

Tests should include:

-   Device behaviour
-   DREO App behaviour
-   Incoming WebSocket reports
-   SDK state synchronization

Whenever possible, compare the SDK behaviour with the official DREO application.

---

# Reverse Engineering

Unknown protocol fields should never be discarded.

Instead:

-   store them in `state.raw`
-   document their behaviour
-   verify them using live captures
-   implement support only after their behaviour is understood

---

# Documentation

Documentation is considered part of the implementation.

Whenever a new protocol behaviour is discovered:

-   update WebSocket.md
-   update ReverseEngineering.md if applicable
-   update Architecture.md if the SDK design changes

Documentation should always remain synchronized with the code.

---

# Commits

A feature is considered complete only after:

-   implementation
-   testing
-   documentation
-   successful compilation

Only then should the feature be committed.

---

# Design Philosophy

The SDK should expose simple, high-level methods.

Example:

```ts
await device.setBrightness(50);
```

instead of requiring users to know protocol details such as:

```json
{
    "poweron": true,
    "lighton": true,
    "brightness": 50
}
```

The SDK is responsible for translating high-level commands into DREO protocol messages.

---

# Long-Term Goal

The DREO SDK should become the single source of truth for DREO device communication.

Future integrations such as ioBroker should contain almost no protocol-specific logic.

Instead, integrations should simply call SDK methods and receive synchronized device state updates.

## SDK Design Principles

The SDK follows a small and stable public API.

### Public API

The following classes are considered public and stable:

-   DreoClient
-   DreoDevice
-   StateMapper
-   DreoDeviceState
-   Device
-   FamilyTree
-   DreoError hierarchy

### Internal Components

The following classes are internal implementation details and should not be used directly by SDK consumers:

-   AppApi
-   DeviceApi
-   HttpClient
-   DreoWebSocketClient
-   DeviceStateMapper
-   FamilyTreeMapper
-   WebSocket protocol models

### Validation

All public setter methods validate their input before sending commands to the DREO cloud.

Invalid values result in a `DreoValidationError`.

### Error Handling

The SDK provides dedicated error types:

-   DreoError
-   DreoValidationError
-   DreoAuthenticationError
-   DreoWebSocketError

## Research Tools

The repository also contains internal research utilities.

These are development tools and are not part of the public SDK.

Current tools include:

-   WebSocket monitor
-   Command tester
-   Capability inspector

They are used to reverse engineer undocumented DREO APIs and validate SDK behaviour.

---

# Development Tools and Test Scripts

The `tools` directory contains development and reverse-engineering utilities.

These scripts are not part of the public SDK API.

Most tools require the following environment variables through `.env`:

    DREO_EMAIL=...

    DREO_PASSWORD=...

    DREO_REGION=EU

## Read-only or mostly safe tests

The following tools are primarily read-only or diagnostic:

-   `tools/test-token-refresh.ts`

    -   verifies HTTP token refresh after an intentionally invalidated access token

    -   reads FamilyTree and device state

    -   does not intentionally change device settings

-   `tools/test-websocket-refresh.ts`

    -   verifies WebSocket reconnect after HTTP token refresh

    -   reads FamilyTree and device state

    -   does not intentionally change device settings

-   `tools/test-resolved-devices.ts`

    -   loads resolved devices

    -   prints discovered states, capabilities, constraints, known unassigned states and unknown states

    -   does not intentionally change device settings

-   `tools/test-state-constraint-validator.ts`

    -   tests the generic constraint validator without connecting to DREO

    -   does not require real devices

    -   does not require DREO credentials

-   `tools/test-websocket-double-connect.ts`

    -   verifies that repeated WebSocket connect calls are handled safely

-   `tools/test-websocket-disconnect-during-connect.ts`

    -   verifies disconnect handling while a WebSocket connection is still being established

-   `tools/test-websocket-logger.ts`

    -   verifies WebSocket logger integration

-   `tools/test-client-login-logger.ts`

    -   verifies client login logger integration

-   `tools/test-authenticated-http-logger-refresh.ts`

    -   verifies logger output during authenticated HTTP refresh handling

## Tests that send real commands

The following tests send commands to real devices.

Use them carefully.

-   `tools/test-device-command-validation.ts`

    -   expects a device named `Standventilator`

    -   verifies that `setWindLevel(9)` is rejected for `DR-HPF002S`

    -   sends a real valid command afterwards

    -   sets the device to fan level 8

## Debug and reverse-engineering tools

The following tools are used for protocol inspection:

-   `tools/debug-capabilities.ts`

    -   prints capability and `controlsConf` information from FamilyTree

    -   useful for identifying device-specific constraints and control metadata

-   `tools/debug-device-state.ts`

    -   prints raw device state

    -   useful for discovering unknown state keys

## WebSocket monitoring

A dedicated WebSocket monitor may be used to observe live reports while changing settings in the DREO app, by remote control, or directly on the device.

The monitor should be used to identify unknown states and verify state changes before adding new SDK support.

Unknown states should remain visible until their behavior is understood.

Do not guess the meaning of unknown protocol fields.
