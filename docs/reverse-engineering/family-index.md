# Family Index

Observed in official Dreo iOS app.

## Endpoint

/api/app/index/family/...

## Purpose

Returns all homes/families visible to the current user.

## Response

familyRooms[]

Each family contains:

-   familyId
-   familyName
-   owner
-   userId
-   avatarType
-   avatarValue
-   rooms[]

Each room contains:

-   id
-   roomName
    ...

## Multi-account and shared family behavior

The observed test account does not own any devices.

The account has access to a shared family/home owned by another Dreo account.

The `/api/app/index/family/room/devices` endpoint still returns the shared family, its rooms and devices.

Observed implications:

-   A family can be visible even if `owner` is `false`.
-   Device access is not limited to owner accounts.
-   SDK consumers must not assume that the authenticated account owns the returned family.
-   Family IDs must be discovered dynamically through the API.
-   The ioBroker adapter should support owner accounts and invited member accounts.
-   The adapter should allow selecting one or multiple visible families instead of hardcoding a family ID.
