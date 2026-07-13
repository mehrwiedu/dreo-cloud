# DREO TypeScript SDK and ioBroker Adapter

An unofficial TypeScript SDK and ioBroker adapter for selected DREO smart home devices.

This project provides a reusable SDK for DREO cloud communication and a thin ioBroker adapter built on top of that SDK.

The implementation is based on reverse engineering of the official DREO mobile application, its HTTP APIs, and its WebSocket protocol.

> This project is not affiliated with, endorsed by, or supported by DREO.

## Project status

The project currently provides a stable development foundation and is suitable for early testing.

The SDK and adapter are functional with the devices listed below, but the project should still be considered experimental. DREO may change its private cloud APIs without notice.

The current version is `0.1.0`.

## Features

### SDK

- Email and password authentication
- Region-aware cloud access
- Automatic re-login after HTTP `401` responses
- WebSocket connection management
- WebSocket reconnect after session refresh
- FamilyTree-based device discovery
- Runtime discovery of newly available devices
- Device state cache
- Incremental live state updates
- Capability and state resolution
- State constraints and command validation
- Structured logging
- Typed public API
- Safe disconnect and cleanup handling

### ioBroker adapter

- DREO account configuration
- Automatic device discovery
- Dynamic object and state creation
- Raw device states
- Friendly state mappings
- Live updates through WebSocket reports
- Writable power, fan, speed, and light controls where supported
- Runtime initialization of newly discovered devices
- Protected and encrypted password configuration

## Tested devices

| Model | Device type | Tested quantity | Notes |
|---|---|---:|---|
| `DR-HCF007S` | Ceiling fan | 3 | Fan, main light, brightness, color temperature, and live state updates |
| `DR-HPF002S` | Stand fan | 1 | Fan control and live state updates; no main light |
| `DR-HHM001S` | Humidifier | 1 | Discovery, object creation, power state, humidity values, and live updates |

Other DREO devices may be discovered successfully, but they are not automatically considered fully supported.

## Important device-mapping note

DREO state names are not always semantically identical across device types.

For example, a raw state named `lighton` must not automatically be interpreted as a main light. Depending on the device, it may represent a real main light, a display, a status LED, an ambient light, or another device-specific light function.

Friendly state mappings are therefore resolved using device type and capability information where possible.

## Architecture

The project follows an SDK-first architecture.

```text
DREO cloud
    |
    v
DREO TypeScript SDK
    |
    v
ioBroker adapter
```

Business logic belongs in the SDK. The ioBroker adapter should remain a thin integration layer.

The FamilyTree endpoint is the primary source for device discovery.

## Repository structure

```text
packages/
  dreo-api/          TypeScript SDK
  iobroker.dreo/     ioBroker adapter

tools/               Development and integration test tools
docs/                Architecture and reverse-engineering documentation
examples/            Public SDK usage examples
```

## Development requirements

- Node.js 22 or newer
- npm
- A DREO account using email and password login
- Access to at least one compatible DREO device

## Installation for development

```bash
git clone https://github.com/mehrwiedu/dreo-cloud.git
cd dreo-cloud
npm install
```

Create a local `.env` file:

```dotenv
DREO_EMAIL=your-email@example.com
DREO_PASSWORD=your-password
DREO_REGION=EU
```

The `.env` file is ignored by Git and must never be committed.

## Build

```bash
npm run build -w @dreo/api
npm run build -w iobroker.dreo
```

Type-check both packages:

```bash
npm run typecheck -w @dreo/api
npm run typecheck -w iobroker.dreo
```

## Development tests

```bash
npx tsx tools/test-client-devices.ts
npx tsx tools/test-token-refresh.ts
npx tsx tools/test-websocket-refresh.ts
npx tsx tools/test-runtime-device-discovery.ts
```

These tools use the credentials from the local `.env` file.

Some tools communicate with real devices and the DREO cloud. Review a tool before running it.

## Runtime discovery

When the SDK receives a WebSocket report for an unknown device, it reloads the FamilyTree and checks whether the device has become available.

If the device is found:

1. its current state is loaded,
2. its capabilities are resolved,
3. it is registered in the SDK,
4. a discovery event is emitted,
5. the original WebSocket state report is processed.

The ioBroker adapter listens for this discovery event and creates the required objects and states without requiring a restart.

## Cloud dependency

This project depends on DREO cloud services and does not provide local-only control.

Functionality may be affected by DREO server outages, API changes, WebSocket protocol changes, account restrictions, region-specific differences, or changes to the official mobile application.

## Security

- Never commit `.env` files.
- Never publish access tokens, refresh tokens, account IDs, device serial numbers, or WebSocket captures.
- Treat diagnostic logs as private.
- Use a dedicated test account where practical.
- Review logs before sharing them publicly.

## Documentation

Additional documentation is available under `docs/`.

Relevant documents include:

- `docs/architecture.md`
- `docs/Development.md`
- `docs/reverse-engineering/authentication.md`
- `docs/reverse-engineering/websocket.md`
- `docs/api/resolved-devices.md`
- `docs/roadmap.md`

Some reverse-engineering documentation may describe internal or experimental behavior and should not be treated as a stable public API contract.

## Known limitations

- Device support is currently limited to tested models and discovered capabilities.
- Not every raw DREO state has a friendly mapping.
- Some advanced functions are not yet implemented.
- Timer, schedule, oscillation, RGB effects, presets, and model-specific modes may be incomplete.
- Apple and Google login are not supported.
- The cloud API is private and undocumented.
- The SDK and adapter are not yet published as public npm packages.

## Planned work

- Additional tested device models
- Improved device-type-specific mappings
- More automated tests
- Adapter icon and public adapter documentation
- Installation instructions for end users
- Review for ioBroker repository requirements

## Contributing

Contributions are welcome, especially for additional device models, verified state mappings, protocol observations, tests, documentation, and bug reports.

Do not include personal credentials, tokens, device serial numbers, or private cloud captures in issues or pull requests.

See `CONTRIBUTING.md` for development guidance.

## License

MIT
