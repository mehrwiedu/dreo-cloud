# SDK Roadmap

## Completed foundation

- [x] Email/password login
- [x] EU and US regions
- [x] Session refresh after HTTP `401`
- [x] Authenticated HTTP retry
- [x] FamilyTree discovery
- [x] Initial device-state loading
- [x] WebSocket live updates
- [x] WebSocket reconnect after session refresh
- [x] Runtime device discovery
- [x] Real-device hot-add while the integration remains running
- [x] Resolved devices and capabilities
- [x] Known, unknown and unassigned states
- [x] State constraints and command validation
- [x] Structured logger interface
- [x] Typed public SDK entrypoint
- [x] Safe connect/disconnect behavior
- [x] Failed `control-reply` rejection

## Confirmed controls

- [x] Power, fan and wind level
- [x] Main light, brightness and color temperature
- [x] Atmosphere light and brightness
- [x] Display and indicator controls
- [x] Mute
- [x] Child lock
- [x] Fan modes
- [x] Sleep light
- [x] Power-on and power-off timers
- [x] Directional oscillation mode
- [x] Horizontal and vertical angle presets
- [x] Humidifier mode
- [x] Humidifier fog level
- [x] Humidifier auto and sleep target humidity
- [x] Humidifier filter confirmation
- [x] Humidifier warm mist
- [x] Humidifier indicator levels
- [x] Humidifier humidity thresholds
- [x] Air-purifier modes and fan levels
- [x] Air-purifier mood-light and display controls
- [x] Air-purifier mute, child lock and power recovery
- [x] Air-purifier PM2.5, air-quality level and filter-life information

## Deliberately raw-only

- [x] `predefine` remains read-only
- [x] `fixedconf` remains read-only
- [x] Unverified RGB effects remain read-only

## Next validation work

- [ ] Friendly object creation when a known raw key first appears after initialization
- [ ] Partially shared homes/devices using a third account
- [ ] Additional models and device categories
- [ ] Long-running reconnect and stability validation

## Productization

- [ ] Logging redaction review
- [ ] Token persistence
- [ ] Public SDK examples review
- [ ] Adapter setup guide
- [ ] Release/version decision
- [ ] npm and ioBroker repository preparation

## Authentication research

- [ ] Apple login
- [ ] Google login

The SDK is adapter-ready. New functionality should continue incrementally and only after isolated device validation.
