# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added

-   TypeScript SDK for DREO cloud communication
-   Email and password authentication with region support
-   Automatic re-login and HTTP retry after `401` responses
-   WebSocket connection management
-   Automatic WebSocket reconnect after session refresh
-   FamilyTree-based device discovery
-   Runtime discovery of newly available devices
-   Device state cache and incremental live state updates
-   Capability resolution and resolved device metadata
-   Known, unknown, and unassigned state separation
-   State constraints and device-specific constraint refinement
-   Command validation for writable states
-   Multi-parameter WebSocket commands
-   Structured SDK logging through `DreoLogger`
-   Safe WebSocket connect, disconnect, and reconnect handling
-   ioBroker adapter package
-   ioBroker account configuration for email, password, and region
-   Dynamic ioBroker object and state creation
-   Raw device states
-   Friendly state mappings
-   Writable power, fan, speed, and light controls where supported
-   Runtime initialization of newly discovered devices in ioBroker
-   Protected and encrypted adapter password configuration
-   Development and integration test tools

### Changed

-   Friendly light mappings are now device-type and capability aware
-   `lighton` is no longer treated as a main light for every device
-   The stand fan `DR-HPF002S` resolves its light-related state without exposing a false main-light mapping
-   The ioBroker adapter now waits for runtime device initialization before applying live state updates
-   Repository documentation was updated for the SDK and ioBroker adapter
-   npm package archives are ignored by Git

### Removed

-   Unsafe example that automatically controlled the first compatible device
-   Obsolete generated repository structure file
-   Duplicate changelog under `docs/`

### Verified

The following devices have been tested:

-   `DR-HCF007S` ceiling fan, three devices
-   `DR-HPF002S` stand fan, one device
-   `DR-HHM001S` humidifier, one device

Verified functionality includes:

-   DREO cloud login in the EU region
-   FamilyTree discovery of five real devices
-   HTTP `401` re-login and retry
-   WebSocket reconnect after session refresh
-   WebSocket double-connect protection
-   Safe disconnect during a pending WebSocket connection
-   SDK logger propagation
-   Device-specific wind-level validation for `DR-HPF002S`
-   Runtime device discovery through `device-online`
-   Duplicate discovery prevention
-   ioBroker object and state creation for the humidifier
-   Live app-to-cloud-to-WebSocket-to-SDK-to-ioBroker state updates
-   Live power state changes for `DR-HHM001S`
-   TypeScript typecheck and build for both packages

### Security and publication preparation

-   Private WebSocket captures were moved outside the repository
-   The repository was scanned for personal email addresses, real device serial numbers, tokens, private IP addresses, and internal filesystem paths
-   No personal credentials, device serial numbers, private infrastructure references, or access tokens were found in the currently tracked files
-   The project remains experimental and depends on undocumented DREO cloud APIs

## 0.1.0

Initial development version.
