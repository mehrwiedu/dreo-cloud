# SDK Roadmap

## Authentication

-   [x] Email/password login
-   [ ] Apple login
-   [ ] Google login
-   [x] Token refresh
-   [ ] Token persistence

## API

-   [x] Bootstrap endpoint documented
-   [x] Family / room / device tree endpoint discovered
-   [x] Family tree endpoint implemented
-   [x] Device state endpoint
-   [ ] Device setting endpoint
-   [ ] Device command endpoint
-   [x] WebSocket endpoint

## Domain Models

-   [x] Family
-   [x] Room
-   [x] Device
-   [x] FamilyTree
-   [ ] DeviceResources
-   [ ] DeviceMetadata
-   [x] DeviceCapabilities
-   [x] DeviceState

## SDK

-   [x] HttpClient
-   [x] AuthManager
-   [x] AppApi
-   [x] DreoClient
-   [x] FamilyTreeMapper
-   [x] Automatic client login
-   [x] Public SDK entrypoint
-   [x] Error model
-   [ ] Logging redaction
-   [x] Central logger interface
-   [x] Session observer mechanism
-   [x] WebSocket reconnect after session refresh

## ioBroker Adapter

-   [ ] Adapter package
-   [ ] Login configuration
-   [ ] Automatic family discovery
-   [ ] Room and device state tree
-   [ ] Device state synchronization
-   [ ] Commands
-   [ ] WebSocket live updates
-   [ ] Generate states only for supported device capabilities

## Documentation

-   [x] Login protocol
-   [x] Bootstrap endpoint
-   [x] Device profile
-   [x] Family / room / device discovery
-   [x] Development guide
-   [ ] SDK examples
-   [ ] Adapter setup guide

## Research

-   [x] WebSocket command protocol
-   [x] Device state mapping
-   [x] FamilyTree capability analysis
-   [ ] Device capability endpoint discovery
-   [ ] RGB preset protocol
-   [ ] RGB effect protocol
-   [x] WebSocket lifecycle behaviour
-   [x] Token refresh and WebSocket reconnect behaviour

## Next SDK Focus

-   [x] Make ResolvedDevice easier to consume from DreoClient
-   [x] Expose adapter-friendly resolved capabilities
-   [x] Generate supported command/state metadata from resolved capabilities
-   [x] Prepare SDK output for ioBroker state generation

## SDK v0 Adapter-Ready Status

-   [x] Email/password login
-   [x] Token refresh
-   [x] WebSocket reconnect after session refresh
-   [x] FamilyTree discovery
-   [x] Device state loading
-   [x] ResolvedDevice model
-   [x] Capability metadata
-   [x] State details
-   [x] Known, unknown and unassigned state separation
-   [x] State constraints
-   [x] Device-specific controlsConf constraint refinement
-   [x] Command validation against resolved constraints
-   [x] SDK package build configuration
-   [x] Adapter-friendly public exports

The SDK is considered adapter-ready for the first ioBroker adapter implementation.

Remaining SDK work can continue incrementally while the adapter is developed.
