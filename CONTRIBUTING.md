# Contributing

Thank you for considering a contribution to the DREO TypeScript SDK and ioBroker adapter.

This project is based on reverse engineering of undocumented DREO cloud APIs. Contributions should therefore be careful, reproducible, and explicit about what was actually verified.

## Before contributing

Please keep the following rules in mind:

-   Do not include DREO account credentials.
-   Do not include access tokens, refresh tokens, account IDs, or session data.
-   Do not include real device serial numbers.
-   Do not include private WebSocket captures or diagnostic logs without sanitizing them first.
-   Do not include private IP addresses, hostnames, filesystem paths, or infrastructure details.
-   Do not claim support for a device or feature unless it was verified.
-   Do not assume that identical raw state names mean the same thing on every device type.

## Development setup

Requirements:

-   Node.js 22 or newer
-   npm
-   A primary DREO account that owns the home and devices
-   A separate SDK or adapter account that supports email and password login
-   A DREO home shared from the primary account with the SDK or adapter account
-   At least one compatible DREO device for integration testing

The SDK and adapter must be configured with the secondary SDK or adapter account, not the primary owner account. This shared-account setup is currently required because device discovery relies on the `FamilyTree` visible to the invited account.

Install dependencies:

```bash
npm install
```

Create a local `.env` file:

```dotenv
DREO_EMAIL=your-email@example.com
DREO_PASSWORD=your-password
DREO_REGION=EU
```

The `.env` file is ignored by Git and must never be committed.

## Build and type-check

SDK:

```bash
npm run typecheck -w @dreo/api
npm run build -w @dreo/api
```

ioBroker adapter:

```bash
npm run typecheck -w iobroker.dreo
npm run build -w iobroker.dreo
```

Both packages must type-check and build successfully before a change is submitted.

## Project architecture

The project follows an SDK-first architecture.

Business logic belongs in `packages/dreo-api`.

The ioBroker adapter under `packages/iobroker.dreo` should remain a thin integration layer that:

-   reads adapter configuration,
-   connects through the SDK,
-   creates ioBroker objects and states,
-   forwards user writes to the SDK,
-   and reflects SDK state updates in ioBroker.

The FamilyTree endpoint is the primary source for device discovery.

Do not introduce `DeviceApi.list()` as the primary discovery mechanism.

## Device support and state mapping

Device behavior must be treated as device-type and capability specific.

For example, the raw state `lighton` does not always mean a main light. Depending on the device, it may represent a display, status LED, ambient light, or another device-specific function.

When adding a friendly mapping:

1. confirm the behavior on a real device,
2. record the device model,
3. verify the relevant raw states,
4. verify the resulting command behavior,
5. document the observation,
6. add or update a test where practical.

Unknown raw states should be preserved rather than discarded.

## Tests and diagnostic tools

Development and integration tools are located under `tools/`.

Before running a tool, review whether it:

-   only reads cloud state,
-   writes device state,
-   changes local SDK caches,
-   or intentionally breaks authentication for refresh testing.

Useful tools include:

```bash
npx tsx tools/test-client-devices.ts
npx tsx tools/test-token-refresh.ts
npx tsx tools/test-websocket-refresh.ts
npx tsx tools/test-runtime-device-discovery.ts
```

Tests that depend on real devices should clearly state:

-   which device model was used,
-   whether the test is read-only,
-   and whether the device state may change.

## Coding guidelines

-   Use TypeScript.
-   Keep changes small and focused.
-   Prefer one responsibility per change.
-   Keep public APIs typed.
-   Avoid hidden side effects.
-   Preserve existing behavior unless the change intentionally modifies it.
-   Add logging through `DreoLogger` rather than direct SDK console output.
-   Do not swallow errors without a documented reason.
-   Keep adapter-specific behavior out of the SDK.
-   Keep protocol and device behavior logic out of the adapter.

## Commit guidelines

Use short, descriptive commit messages.

Examples:

```text
Add runtime device discovery
Validate device commands against constraints
Map stand fan light state as display
```

Avoid mixing unrelated refactoring, documentation, and behavior changes in one commit where possible.

## Documentation

Update documentation when changing:

-   public SDK behavior,
-   supported devices,
-   state mappings,
-   command behavior,
-   authentication,
-   WebSocket handling,
-   runtime discovery,
-   or adapter configuration.

Relevant locations include:

-   `README.md`
-   `CHANGELOG.md`
-   `docs/architecture.md`
-   `docs/api/`
-   `docs/reverse-engineering/`

Historical observations should be clearly marked when they are no longer current.

## Pull requests

A pull request should include:

-   a clear description of the problem,
-   the implemented solution,
-   affected device models,
-   testing performed,
-   expected limitations,
-   and any documentation changes.

Do not attach raw private logs. Provide sanitized excerpts only.

## Reporting device behavior

When reporting a new device or state mapping, include:

-   model identifier,
-   device type,
-   relevant raw state names,
-   observed values before and after the action,
-   the action performed in the DREO app or SDK,
-   and whether the result was repeatable.

Replace real serial numbers with placeholders.

## License

By contributing, you agree that your contributions may be distributed under the MIT License.
