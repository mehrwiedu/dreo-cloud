# Family Index

Observed in the official DREO iOS app and verified against DREO Cloud communication.

## Endpoint

`/api/app/index/family/...`

## Purpose

Returns all homes or families visible to the authenticated user.

## Response

`familyRooms[]`

Each family contains:

-   `familyId`
-   `familyName`
-   `owner`
-   `userId`
-   `avatarType`
-   `avatarValue`
-   `rooms[]`

Each room contains fields including:

-   `id`
-   `roomName`
-   devices assigned to the room

## Required shared-account setup

The currently supported SDK and ioBroker adapter setup uses a dedicated secondary account:

1. The primary DREO account owns the home and devices.
2. A separate SDK or adapter account is created with email and password login.
3. The primary account shares its home with the secondary account.
4. The SDK or adapter authenticates as the invited secondary account.

The invited account does not need to own the devices. The `/api/app/index/family/room/devices` endpoint returns the shared family, its rooms and its devices to that account.

Creating and sharing the secondary account is currently required because device discovery relies on the `FamilyTree` returned for the invited account.

## Observed implications

-   A family can be visible when `owner` is `false`.
-   Device access is not limited to the owner account.
-   The authenticated SDK or adapter account must have access to the shared family.
-   Family IDs must be discovered dynamically through the API.
-   The implementation must not assume ownership of a returned family.
-   No family ID may be hardcoded.
