# DREO TypeScript SDK

An unofficial TypeScript SDK for selected DREO cloud-connected devices. The ioBroker integration is maintained separately in `mehrwiedu/ioBroker.dreo-cloud`.

> This project is not affiliated with, endorsed by, or supported by DREO.

## Project status

The SDK is functional and used by the separate Creator-based `ioBroker.dreo-cloud` adapter. The project is suitable for controlled testing, but remains experimental because DREO uses private and undocumented cloud APIs.

Current package versions:

- SDK: `@mehrwiedu/dreo-api` `0.1.4`
- Creator adapter: `iobroker.dreo-cloud` `0.1.3`

## Architecture

```text
DREO cloud
    |
    v
@mehrwiedu/dreo-api
    |
    v
ioBroker.dreo-cloud
```

The SDK owns DREO protocol handling, device semantics, native command construction, state constraints and validation. The adapter owns ioBroker objects, friendly state metadata, write routing and acknowledgement behavior.

FamilyTree is the only primary device-discovery source. Initial state requests enrich devices that were already discovered through FamilyTree.

## SDK features

- Email/password authentication
- EU and US region support
- Automatic login refresh after HTTP `401`
- WebSocket lifecycle management and reconnect
- FamilyTree-based device discovery
- Runtime discovery of newly available devices
- Initial state loading and incremental live reports
- Device state cache
- Capability and state resolution
- Known, unknown and unassigned state separation
- State constraints and command validation
- Single- and multi-parameter WebSocket commands
- Rejection of failed `control-reply` messages
- Structured optional logging
- Typed public API
- Safe connect, disconnect and cleanup behavior

## Tested devices

| Model | Type | Quantity | Validated areas |
|---|---|---:|---|
| `DR-HCF007S` | Ceiling fan | 3 | Fan, modes, main light, brightness, color temperature, atmosphere light, power/component-mask semantics, timers, child lock, live updates |
| `DR-HCF001S` | Ceiling fan | 1 | Components without `poweron`, fan modes, timers and live updates |
| `DR-HPF002S` | Stand fan | 1 | Fan, modes, display, directional oscillation, axis-specific angles and live updates |
| `DR-HHM001S` | Humidifier | 1 | Power, modes, fog level, target humidity, indicators, filter state, operating information, timers and live updates |
| `DR-HHM003S` | Humidifier | 1 | Power, modes, fog level, auto/sleep target humidity, warm mist, three-level indicators, humidity thresholds, filter state and live updates |
| `DR-HAP009S` | Air purifier | 1 | Power, modes, fan levels, mood light, display, mute, child lock, power recovery, PM2.5, air-quality level, filter life, live updates and firmware-update observation |

Other devices may be discovered and exposed through raw states, but are not automatically considered fully supported.

## Important state-mapping rule

DREO state names are not globally semantic.

For example, `lighton` can represent a main light, a display or another device-specific light function. Friendly mappings are therefore selected from the confirmed device context rather than from the raw key alone.

Unknown raw fields are preserved. They remain read-only until their meaning and write behavior are verified.

## Confirmed high-level controls

Depending on the device and its reported state set, the SDK supports:

- power, fan and wind level
- main light, brightness and color temperature
- atmosphere light and brightness
- display and humidifier indicators
- mute and child lock
- fan modes
- sleep-light scene
- power-on and power-off timers
- directional oscillation mode
- horizontal and vertical angle presets
- humidifier mode, fog level and target humidity
- humidifier warm mist and indicator levels
- humidifier humidity-threshold configuration
- humidifier filter confirmation
- air-purifier modes and fan levels
- air-purifier mood-light and display controls
- air-purifier mute, child lock and power recovery
- air-purifier PM2.5, air-quality level and filter-life information

## Deliberately unsupported controls

Ceiling-fan favorites exposed as raw `predefine` values are not implemented as writable SDK controls.

Testing showed that writing the slot value does not execute the stored scene, while numeric writes are rejected by the DREO cloud. The SDK therefore keeps this value raw and read-only instead of synthesizing an unverified scene.

`fixedconf` and unverified RGB effects also remain raw-only.

## Account setup

The current SDK and ioBroker adapter use a two-account setup:

1. The primary DREO account owns the home and its devices.
2. A separate SDK or adapter account is created with email and password login.
3. The primary account shares its home with this secondary account in the DREO app.
4. The SDK or ioBroker adapter is configured with the secondary account credentials.

Creating and sharing this secondary account is currently required, not optional. Device discovery relies on the `FamilyTree` visible to the invited SDK or adapter account. Accounts that can only authenticate through Apple or Google login are not currently supported.

## Installation

The SDK is published on npm:

    npm install @mehrwiedu/dreo-api@0.1.4

## Development

Requirements:

- Node.js 22 or newer
- npm
- a DREO account that supports email/password login
- a shared DREO home visible to that account

Install dependencies:

```bash
npm install
```

Build and type-check:

```bash
npm run typecheck:sdk
npm run build:sdk
npm run check
```

Targeted tools live under `tools/`. Some tools communicate with real devices. Review them before execution.

## Runtime discovery

When a WebSocket message references an unknown device, the SDK reloads FamilyTree. Only devices present there are initialized.

For a newly discovered device, the SDK:

1. loads its initial state,
2. resolves capabilities and constraints,
3. registers the device,
4. emits the discovery event,
5. applies the original live report.

## Cloud dependency

This project does not provide local-only control. DREO outages or protocol changes can affect functionality without notice.

## Security

- Never commit `.env` files.
- Never publish credentials, tokens, account IDs, device serial numbers or private captures.
- Treat diagnostic logs as private.
- Prefer a dedicated secondary DREO account.
- Review logs before sharing them.

## Documentation

- `docs/architecture.md`
- `docs/Development.md`
- `docs/api/resolved-devices.md`
- `docs/reverse-engineering/websocket.md`
- `docs/reverse-engineering/Device-state.md`
- `docs/roadmap.md`

## Known limitations

- Apple and Google login are not supported.
- Token persistence is not implemented.
- Not every raw field has a friendly mapping.
- Friendly structures are not yet generated automatically when a known key first appears only after initialization.
- Partially shared homes/devices still require dedicated testing.
- The cloud API is private and undocumented.

## License

MIT
