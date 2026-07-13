# Device Profile

**Status:** Observed from official Dreo iOS app traffic.

## Source Endpoint

```http
POST /api/app/index/family/room/devices
```

## Purpose

The endpoint returns the visible family/home structure and device information for the authenticated user.

It contains:

-   families / homes
-   rooms
-   devices inside rooms
-   a flat device list
-   device metadata
-   device resources
-   device controls
-   schedule configuration
-   manuals and support resources

## Top-level structure

```text
data
├── familyRooms[]
│   ├── familyId
│   ├── familyName
│   ├── owner
│   └── rooms[]
│       ├── id
│       ├── roomName
│       └── devices[]
└── list[]
    └── full device profiles
```

## Device fields observed

### Basic fields

-   deviceId
-   sn
-   brand
-   model
-   productId
-   productName
-   deviceName
-   shared
-   type
-   owner
-   familyId
-   familyName
-   roomId
-   roomName
-   roomNameI18Key
-   color

### Images and widgets

-   widgetOnImage
-   widgetOffImage
-   widgetAbnormalImage
-   resourcesConf

### Configuration sections

-   controlsConf
-   schedule
-   control
-   mainConf
-   servicesConf
-   userManuals
-   version

## Important observation

The response is much more than a simple device list.

It appears to contain nearly everything the official Dreo app needs to build its complete user interface.

This endpoint is likely the primary endpoint of the Dreo cloud API and should become the foundation of this SDK.

The older `/api/v2/user-device/device/list` endpoint appears to be a legacy endpoint and should only be used if additional information is missing.

## Open questions

-   Which fields are always present?
-   Which fields are device-type specific?
-   Which controls are required for ioBroker states?
-   Which controls can be mapped automatically?
-   Which fields should remain raw metadata?

## SDK Decision

The SDK shall expose three abstraction layers:

-   Family
-   Room
-   Device

The raw API response will be preserved internally, but consumers of the SDK should primarily work with strongly typed objects.

Complex configuration blocks such as controls, schedules and services will be represented by dedicated models in later SDK versions.
