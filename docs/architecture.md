# Architecture

## Overview

The project uses an SDK-first architecture.

```text
DREO cloud
    |
    +-- HTTP: login, FamilyTree, initial state
    |
    +-- WebSocket: commands and live reports
             |
             v
      @mehrwiedu/dreo-api
             |
             v
      ioBroker.dreo-cloud
```

The SDK is reusable outside ioBroker. The adapter is a thin integration layer.

## Discovery boundary

FamilyTree is the only primary device-discovery source.

The initial device-state endpoint does not discover additional devices. It enriches devices that were already found through FamilyTree with current values and available state keys.

When a live message references an unknown serial number, the SDK reloads FamilyTree. The device is initialized only if FamilyTree contains it.

## Core components

### `DreoSession`

- owns the active authentication state
- performs login and refresh
- notifies observers after session changes

### `AuthenticatedHttpClient`

- sends authenticated HTTP requests
- triggers one session refresh after HTTP `401`
- retries the request with refreshed credentials

### `DreoWebSocketClient`

- connects with the active session token
- sends control commands
- receives live reports
- reconnects after session changes
- protects against duplicate connections
- rejects pending replies on disconnect or reconnect
- rejects failed `control-reply` messages

### `DreoClient`

- coordinates login, FamilyTree and initial-state loading
- creates and registers `DreoDevice` instances
- routes live reports
- handles runtime discovery

### `DreoDevice`

- stores device metadata and state
- merges incremental reports
- exposes high-level controls
- applies model/state guards
- validates native values before sending commands

### State and capability resolvers

- combine FamilyTree metadata with the initial state of an already discovered device
- preserve unknown values
- resolve device-specific constraints
- expose adapter-friendly metadata

## Responsibility split

### SDK

The SDK owns:

- DREO protocol models
- native command payloads
- device semantics
- command dependencies
- model-specific guards
- constraints and validation
- protocol error handling

### Adapter

The adapter owns:

- ioBroker configuration
- object and state creation
- friendly names and roles
- write routing to public SDK methods
- `ack` handling and write reconciliation
- read-only raw-state presentation

The adapter must not construct DREO-native payloads such as `cruiseconf`.

## Command flow

```text
ioBroker write
    |
    v
Adapter normalization and routing
    |
    v
DreoDevice public method
    |
    v
SDK validation and payload construction
    |
    v
DreoWebSocketClient
    |
    v
DREO cloud/device
    |
    +-- successful control-reply
    |       |
    |       v
    |   optional immediate reported values
    |
    +-- failed control-reply
            |
            v
        DreoWebSocketError
```

Authoritative live state continues to arrive through device reports. The adapter reconciles identical or rejected writes so states do not remain indefinitely at `ack=false`.

## State model

DREO reports are incremental. The SDK merges them into a cached `DreoDeviceState`.

Unknown keys remain available under `state.raw`. This allows observation before a friendly mapping is implemented.

Raw values are not writable by the adapter.

## Device-specific semantics

Identical raw keys are not assumed to mean the same thing on every model.

Examples:

- `lighton` can be a main light or a display/status light.
- `oscmode` has confirmed directional semantics only on `DR-HPF002S`.
- `DR-HCF001S` has no `poweron`.

Model guards are used only where this semantic difference is confirmed.

## Design principles

- SDK first
- FamilyTree-only primary discovery
- thin adapter
- preserve unknown data
- no speculative commands
- real-device validation before writable exposure
- small, testable changes
