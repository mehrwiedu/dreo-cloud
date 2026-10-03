# Device State

**Status:** Implemented and validated with multiple DREO device families.

## Endpoint

```text
GET /api/user-device/device/state
```

Query parameter:

- `deviceSn`

## Architectural role

FamilyTree is the only primary source for discovering devices.

The device-state endpoint is used only after a device was discovered through FamilyTree. It provides:

- the current state snapshot
- the raw keys currently available on that device
- values used by capability and constraint resolution

It must not be used to invent or discover devices outside FamilyTree.

## State behavior

DREO states are model-specific and incomplete by design.

Examples of observed keys include:

- `connected`
- `poweron`
- `fanon`
- `windlevel`
- `mode`
- `muteon`
- `childlockon`
- `lighton`
- `atmon`
- `brightness`
- `colortemp`
- `timeron`
- `timeroff`
- `oscmode`
- `cruiseconf`
- `rgblevel`
- `ledlevel`
- `filteron`
- `filtertime`
- `worktime`
- `rssi`

Missing keys are expected and are not errors.

## Mapping rules

Raw names are not globally semantic.

- `lighton` can represent a main light or a display/status light.
- `DR-HPF002S` does not expose a main light.
- `DR-HCF001S` does not expose `poweron`.
- directional `oscmode` semantics are confirmed only for `DR-HPF002S`.

Friendly mappings therefore depend on the resolved device context.

### `DR-HCF007S` power and component mask

On `DR-HCF007S`, `fanon`, `lighton` and `atmon` form a persistent
component-selection mask. `poweron` is the aggregate activation state for
that mask.

- `poweron=false` switches the aggregate device state off without clearing
  the stored component mask or its associated level values.
- `poweron=true` reactivates the stored mask. If all three component states
  are false, native DREO behavior activates `fanon`, `lighton` and `atmon`
  together; the SDK reproduces this recovery behavior.
- Enabling an individual component while `poweron=true` is additive and
  leaves the other selected components unchanged.
- Enabling an individual component while `poweron=false` is exclusive:
  the requested component is selected, the other two component states are
  cleared, and `poweron` becomes true.
- Disabling one of several active components clears only that component.
  Disabling the last active component turns `poweron` off while preserving
  the last component in the stored mask.
- Level values remain persistent unless that level is explicitly changed.
  For example, switching the fan or main light back on does not reset
  `windlevel`, `brightness` or `colortemp`.

The SDK applies the same component-activation rules to controls that already
have an established component dependency:

- `windlevel > 0` activates `fanon`
- `brightness` and `colortemp` activate `lighton`
- `rgbpresetsel > 0` and `atmbri` activate `atmon`

Real-device tests directly confirmed the off-state activation behavior for
`windlevel` and `brightness`. Friendly component states are normalized to off
while `poweron=false`, even though the raw component mask is retained.

## State cache

Live reports are incremental. The SDK merges each report into the existing `DreoDeviceState`.

Unknown fields are preserved under:

```ts
state.raw
```

The ioBroker adapter exposes raw fields read-only.

## Runtime keys

A raw key can first appear after initialization. The adapter creates and logs the new raw state dynamically.

Current limitation: a complete friendly-state structure is not yet created automatically when a known key first becomes available only after initialization.

## Confirmed special cases

### Effective power-scoped states

A component can retain its raw value while aggregate power is off. Friendly states show the effective user-visible state without destroying the raw value.

### Humidifier indicators

`rgblevel` and `ledlevel` retain their level values but are effectively off while `poweron=false`. Writes are allowed only while the humidifier is powered on.

### Directional oscillation

For `DR-HPF002S`:

- `oscmode 0`: off
- `oscmode 1`: horizontal
- `oscmode 2`: vertical
- `oscmode 3`: both axes

Horizontal and vertical angle presets are changed independently and only while the related axis is active.

### Timers

Timer values use object payloads containing duration and timestamp. Completion reports can be incomplete and are reconciled conservatively.

### `predefine`

`predefine` is kept raw and read-only.

Writing its string value did not execute the stored DREO app scene, while numeric writes were rejected by the cloud. No writable favorite abstraction is exposed.

## DR-HHM003S humidifier observations

Confirmed model-specific behavior includes:

- operating modes `0` Manual, `1` Auto and `2` Sleep
- manual fog levels `1` through `6`
- auto and sleep target humidity from `30` through `90` percent
- `hotfogon` as warm-mist state
- `rgblevel` values `0`, `1`, `2`
- `ledlevel` values `0`, `1`, `2`
- indicator-level writes require `poweron=true`
- `rgbth` contains the lower and upper humidity thresholds as a comma-separated pair
- threshold writes preserve the unmodified counterpart value
- Sleep turns the mood and display indicators off and the device restores their previous levels when leaving Sleep
- Sleep turns warm mist off; warm mist is not automatically restored after leaving Sleep

## DR-HAP009S air-purifier observations

Confirmed model-specific behavior includes:

- modes `manual`, `auto-regular`, `turbo` and `sleep`
- manual fan levels `1` through `3`
- `rgbalwayson` as mood-light switch
- `rgblevel` values `1` through `3` for mood-light level
- `ledalwayson` as display switch
- `muteon` as mute state
- `childlockon` as child-lock state
- `autoon` as power-recovery state
- `pm25` as the PM2.5 value
- `aq` values `1` through `4` as the observed air-quality level
- `lifetime` as remaining filter-life percentage

### Observed firmware-update sequence

A real `DR-HAP009S` MCU firmware update was recorded end-to-end.

Observed sequence:

1. Before the update, `_ota` was `0`.
2. Shortly after the update was started in the DREO app, `_ota` changed from `0` to `1`.
3. The device then emitted `device-offline`.
4. After reboot, the device emitted `device-online`.
5. The online report contained `_ota=2`.
6. `mcu_firmware_version` changed from `0.2.6` to `0.2.7`.
7. `module_firmware_version` remained `3.8.4`.

The values are documented as an observed sequence, not as a guaranteed universal enumeration of all possible `_ota` states.

The firmware update preserved the confirmed operating configuration observed before the update. Normal air-quality and PM2.5 reports resumed after the device came back online.

## Resolver strategy

For each FamilyTree-discovered device, the SDK combines:

1. FamilyTree metadata
2. initial device state
3. later WebSocket reports
4. confirmed model-specific refinements

This resolves available states and constraints without using a static model list as the primary discovery mechanism.
