# WebSocket Transport

**Status:** Implemented and validated against real DREO devices.

## Endpoint

```text
wss://wsb-{region}.dreo-tech.com/websocket?accessToken={accessToken}&timestamp={timestamp}
```

## Keepalive

The client sends the text message `2` every 15 seconds.

## Commands

```json
{
  "devicesn": "<device serial number>",
  "method": "control",
  "params": {
    "<commandKey>": "<value>"
  },
  "timestamp": 1234567890
}
```

Single- and multi-parameter payloads are supported. Native payload construction belongs in the SDK.

## Message types

### `control-reply`

A `control-reply` is the direct response to a pending command.

A successful reply can include:

```json
{
  "method": "control-reply",
  "devicesn": "<device serial number>",
  "reported": {
    "filteron": true
  }
}
```

A failed reply can include:

```json
{
  "method": "control-reply",
  "devicesn": "<device serial number>",
  "error_code": 500003,
  "error_msg": "instruction validate failed"
}
```

Rules:

- no error fields: success
- `error_code` `0` or `"0"`: success
- non-zero numeric or string error code: reject
- non-empty `error_msg` without a code: reject
- failed replies reject with `DreoWebSocketError`
- pending reply state is cleared for both success and failure
- `reported` values from failed replies are not applied by `DreoDevice`

A successful `control-reply` confirms that the command was accepted. It does not prove that every physical effect has already completed.

### `report` and `control-report`

These messages contain live device updates and are routed to the matching `DreoDevice`.

They are incremental and are merged into the cached state.

### `device-online`

This can trigger runtime discovery. The SDK reloads FamilyTree and initializes the device only if FamilyTree contains it.

## Account-wide behavior

The WebSocket is account-wide. Reports can arrive for any device visible to the authenticated account, not only for the device most recently controlled.

## Lifecycle

Validated behavior:

- repeated `connect()` calls do not create duplicate sockets
- concurrent connection attempts reuse the pending promise
- disconnect during connection setup does not leave a hanging promise
- pending command replies are rejected during disconnect or reconnect
- session refresh reconnects with the new token
- report handlers can be unsubscribed
- repeated synchronization does not register duplicate handlers

## Logging

The client uses the optional shared `DreoLogger` interface:

- `debug(message, data)`
- `info(message, data)`
- `warn(message, data)`
- `error(message, data)`

Production SDK code does not write directly to `console.*`.
