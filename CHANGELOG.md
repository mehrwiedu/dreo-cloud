# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

## 0.1.4 - 2026-10-03

### Fixed

- Corrected `DR-HCF007S` power/component-mask handling so individual fan, main-light and atmosphere-light activation follows the device's validated model-specific semantics instead of reactivating unrelated stored components.
- Level writes that imply component activation now follow the same `DR-HCF007S` mask behavior: `windlevel` activates the fan, `brightness` and `colortemp` activate the main light, and atmosphere RGB controls activate the atmosphere light.

### Verified

- Real-device `DR-HCF007S` validation confirmed persistent component masks across aggregate power-off, additive component activation while powered on, exclusive component activation while powered off, last-component power-off behavior, and preservation of stored level values.
- Independent HTTP state reads were used after each real-device write to verify the resulting cloud/device state separately from the SDK's local command-reply cache.

## 0.1.3 - 2026-09-27

### Added

- Native child-lock control
- Native fan-mode controls for confirmed fan models
- Native humidifier mode, fog-level and target-humidity controls
- Native humidifier filter confirmation
- Humidifier filter-life and operating-hours information
- Directional oscillation modes and axis-specific angle presets for `DR-HPF002S`
- Power-on and power-off timers
- Native sleep-light scene control
- Runtime discovery and incremental device initialization
- Runtime creation and logging of newly observed raw keys
- Regression coverage for failed WebSocket `control-reply` messages
- `error_code` and `error_msg` fields on `DreoWebSocketReply`
- Native `DR-HAP009S` air-purifier modes, fan levels, mood-light, display, mute, child-lock and power-recovery semantics
- `DR-HAP009S` PM2.5, air-quality and filter-life information
- Shared `DR-HHM003S` humidifier semantics
- `DR-HHM003S` warm-mist and three-level mood/display indicator controls
- Humidifier humidity-threshold handling with preservation of the paired threshold

### Changed

- FamilyTree is documented as the only primary device-discovery source.
- Device-state requests enrich devices that were already found through FamilyTree.
- Failed WebSocket control replies now reject with `DreoWebSocketError`.
- State and command semantics remain in the SDK; ioBroker acknowledgement handling remains in the adapter.
- Model-specific light and oscillation mappings are used where identical raw keys have different meanings.
- Incomplete timer-completion reports are reconciled conservatively.

### Removed

- Native ceiling-fan favorite control based on `predefine`.
- The removed control did not execute stored DREO app scenes and numeric writes were rejected by the cloud.

### Verified

- `DR-HCF007S` ceiling fan, three devices
- `DR-HCF001S` ceiling fan, one device
- `DR-HPF002S` stand fan, one device
- `DR-HHM001S` humidifier, one device
- `DR-HHM003S` humidifier, one device
- `DR-HAP009S` air purifier, one device
- EU cloud login and FamilyTree discovery
- HTTP `401` refresh and WebSocket reconnect
- WebSocket lifecycle and pending-reply cleanup
- Runtime discovery without duplicate registration
- Real-device hot-add while the integration remained running
- Device-specific state constraints
- Fan modes, child lock, timers and sleep light
- Humidifier controls, warm mist, indicator levels, humidity thresholds, filter state and operating information
- Air-purifier modes, fan levels, lights, settings, PM2.5, air-quality level and filter life
- `DR-HAP009S` MCU firmware update observation: `_ota` changed `0 -> 1 -> 2` while `mcu_firmware_version` changed from `0.2.6` to `0.2.7`; `module_firmware_version` remained `3.8.4`
- Directional oscillation and independent axis angles
- Rejection of error `500003 / instruction validate failed`
- Successful normal writes after the control-reply error-handling change

## 0.1.0

Initial development version.
