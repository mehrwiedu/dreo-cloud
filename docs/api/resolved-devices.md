cat > docs/api/resolved-devices.md <<'EOF'

# Resolved Devices

`ResolvedDevice` is the adapter-friendly view of a DREO device.

It combines:

-   device metadata from the FamilyTree
-   the current cloud state
-   resolved capabilities
-   discovered state metadata
-   unassigned and unknown states for reverse engineering

The goal is to provide a stable structure for consumers such as the future ioBroker adapter without hiding raw DREO states.

## Source order

Capability resolution currently uses the device state as the primary source and the FamilyTree capabilities as the secondary source.

Reason:

-   the FamilyTree can be incomplete for some devices
-   the device state usually exposes the full set of available states
-   the FamilyTree can still contribute useful capability information
-   the merger keeps the primary source authoritative and only extends it with secondary information

This is intentional.

## ResolvedDevice structure

A resolved device contains:

-   `device`
    -   metadata from the FamilyTree
-   `state`
    -   complete cloud state response
-   `capabilities`
    -   merged capabilities with state keys and optional state metadata
-   `states`
    -   all discovered states
-   `unassignedStates`
    -   all states not assigned to a capability
-   `unassignedKnownStates`
    -   known states that are not assigned to a capability
-   `unknownStates`
    -   states not yet known by the registry

## Capabilities

A capability groups related DREO states into a functional area.

Currently known capability ids:

-   `fan`
-   `mainLight`
-   `ambientLight`
-   `configuration`
-   `diagnostic`
-   `information`
-   `unknown`

Example:

    {
      id: "fan",
      states: ["mode", "poweron", "windlevel"],
      stateDetails: [
        {
          key: "poweron",
          valueType: "boolean",
          writable: true,
          category: "control",
          description: "Device power",
          known: true
        }
      ]
    }

## stateDetails

`stateDetails` is populated after capability merging.

It contains the discovered metadata for each state assigned to the capability.

This is useful for adapter implementations because the adapter can determine directly:

-   whether a state is writable
-   whether a state is a control, sensor, diagnostic, configuration, or information state
-   which value type is expected
-   whether the state is already known by the SDK registry

## Information capability

The `information` capability is used for known read-only or metadata-like states.

Examples:

-   `module_hardware_mac`
-   `temperature`
-   `timeron`
-   `timeroff`
-   `rgbpresetnum`
-   `scenes`
-   `cruiseconf`
-   `fixedconf`

These states are known and useful, but they are not necessarily direct user controls.

## Known but unassigned states

`unassignedKnownStates` contains states that are known by the registry but intentionally not assigned to a functional capability yet.

This distinction is important.

Example:

-   `lighton` on `DR-HPF002S`

For ceiling fan devices such as `DR-HCF007S`, `lighton` belongs to `mainLight` because it appears together with:

-   `brightness`
-   `colortemp`

For the stand fan `DR-HPF002S`, `lighton` appears without `brightness` and `colortemp`.

Therefore it is not treated as `mainLight`.

Its exact function is still open and should be verified separately before introducing a dedicated capability such as display or panel light.

## Unknown states

`unknownStates` contains states that are not yet known by the registry.

These are reverse-engineering candidates.

Examples currently seen:

-   `_ota`
-   `alignon`
-   `customconf`
-   `mcuon`
-   `scheid`
-   `scheon`
-   `wrong`
-   `#_effect`
-   `#_favorite`
-   `predefine`

These states should not be hidden. They remain visible so that future tests can identify and document their meaning.

## Current device observations

### DR-HPF002S

The stand fan currently resolves to:

-   `fan`
-   `configuration`
-   `diagnostic`
-   `information`

It does not resolve to `mainLight`.

Known but unassigned:

-   `lighton`

This is intentional until the actual device behavior has been verified.

### DR-HCF007S

The ceiling fan currently resolves to:

-   `fan`
-   `mainLight`
-   `ambientLight`
-   `configuration`
-   `diagnostic`
-   `information`

No known states are currently unassigned for this model.

## Regression test

The current regression test is:

    npx tsx tools/test-resolved-devices.ts

The test prints a compact overview for each device:

-   discovered state count
-   resolved capability count
-   unassigned known state count
-   unknown state count
-   capability details
-   unassigned known states
-   unknown states

Expected high-level result:

-   `DR-HPF002S` has `lighton` as known but unassigned
-   `DR-HCF007S` has `mainLight` and `ambientLight`
-   unknown states remain visible for reverse engineering
    EOF

## State constraints

`DiscoveredState` can contain an optional `constraint`.

Constraints describe how a state can safely be used by SDK consumers and adapters.

They are especially important for writable states because they prevent invalid values such as:

-   negative fan speeds
-   brightness values above 100
-   unsupported mode values
-   invalid RGB preset selections

Example:

    {
      key: "windlevel",
      valueType: "number",
      writable: true,
      category: "control",
      description: "Fan speed",
      known: true,
      constraint: {
        type: "number",
        min: 1,
        max: 8,
        step: 1
      }
    }

## Constraint source order

Constraints are resolved in two steps.

First, the SDK registry provides safe default constraints.

Examples:

-   `poweron`
    -   boolean
-   `brightness`
    -   number, 0-100, step 1
-   `colortemp`
    -   number, 0-100, step 1
-   `rgbpresetsel`
    -   number, 0-4, step 1
-   `windlevel`
    -   number, 1-12, step 1

Second, device-specific `controlsConf` data from the FamilyTree can refine these defaults.

This allows the SDK to use better information when DREO provides it, while still remaining useful for devices where `controlsConf` is empty.

## Device-specific constraint refinement

Some devices expose detailed control metadata in `controlsConf`.

Example: `DR-HPF002S`

The stand fan exposes:

-   `windlevel`
    -   start value 1
    -   end value 8
-   `mode`
    -   allowed values 1, 2, 3, 4, 5, 6

Therefore the resolved constraints are:

    windlevel:
      type: number
      min: 1
      max: 8
      step: 1

    mode:
      type: number
      step: 1
      allowedValues: [1, 2, 3, 4, 5, 6]

For devices where `controlsConf` is empty, the SDK keeps the registry defaults.

Example: `DR-HCF007S`

    windlevel:
      type: number
      min: 1
      max: 12
      step: 1

## Adapter usage

Adapters should prefer resolved constraints from `stateDetails`.

For example, an ioBroker adapter can use constraints to derive:

-   `common.type`
-   `common.read`
-   `common.write`
-   minimum and maximum values
-   allowed enum values
-   safe validation before sending commands

The SDK remains adapter-neutral.

It does not create ioBroker objects directly. It only exposes enough metadata for adapters to create correct objects automatically.

## Command validation

Writable states can be validated before a command is sent to the DREO cloud.

`DreoDevice` receives a state constraint map derived from `ResolvedDevice.states`.

When a command is sent through a typed device method, the outgoing payload is validated against the resolved constraints before the WebSocket command is sent.

Example:

    DR-HPF002S:
      windlevel:
        type: number
        min: 1
        max: 8
        step: 1

For this device:

    setWindLevel(8)

is accepted, while:

    setWindLevel(9)

throws a `DreoValidationError` before any command is sent.

This is intentionally enforced inside the SDK.

Adapters can still use constraints to create better UI objects, roles, ranges, and enum states, but the SDK also protects the command path itself.

## Validation behavior

The validator currently supports:

- boolean values
- finite number values
- number minimum and maximum
- number step validation
- explicit numeric allowed values
- string values
- explicit string allowed values
- object values

States without a constraint are not rejected by the generic constraint validator.

This allows unknown or future DREO states to remain observable without blocking SDK evolution.

## Validation test

The command validation can be tested with:

    npx tsx tools/test-device-command-validation.ts

This test uses a real device.

It currently expects a device named `Standventilator` and verifies that:

- `setWindLevel(9)` is rejected for `DR-HPF002S`
- `setWindLevel(8)` is accepted

The test sends a real command and sets the device to fan level 8.
