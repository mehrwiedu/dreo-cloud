# Authentication

## Supported login methods observed in DREO app

-   Email/password login
-   Apple login
-   Google login

## Current SDK status

The SDK currently supports email/password login only.

## Required account setup

The currently supported SDK and ioBroker adapter setup uses two DREO accounts:

1. The primary account owns the DREO home and its devices.
2. A separate SDK or adapter account is created with email and password login.
3. The primary account shares its home with the SDK or adapter account.
4. The SDK or adapter authenticates with the secondary account credentials.

This secondary account and shared-home setup is currently required, not optional.

Device discovery relies on the `FamilyTree` visible to the invited SDK or adapter account. The primary account credentials should not be stored in the SDK or ioBroker adapter.

Accounts that can authenticate only through Apple or Google login are not currently supported. Additional login methods remain possible future work.
