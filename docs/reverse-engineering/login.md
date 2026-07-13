# Dreo Login Protocol

**Status:** ✅ Verified against the official Dreo Cloud API

## Base URL

```
https://app-api-{REGION}.dreo-tech.com
```

Example regions:

-   EU
-   NA

---

## Login Endpoint

```
POST /api/oauth/login
```

---

## Request Headers

| Header          | Value                           |
| --------------- | ------------------------------- |
| ua              | dreo/2.8.2                      |
| lang            | en                              |
| content-type    | application/json; charset=UTF-8 |
| accept-encoding | gzip                            |
| user-agent      | okhttp/4.9.1                    |

If authenticated:

```
Authorization: Bearer <access_token>
```

---

## Login Request Body

| Field          | Value          |
| -------------- | -------------- |
| acceptLanguage | en             |
| client_id      | fixed value    |
| client_secret  | fixed value    |
| email          | user email     |
| encrypt        | ciphertext     |
| grant_type     | email-password |
| himei          | fixed value    |
| password       | MD5 hash       |
| scope          | all            |

---

## Password

The password is transmitted as an MD5 hash.

---

## Successful Login

The API returns:

-   HTTP Status: `200`
-   JSON field `code = 0`

The response contains:

-   region
-   access_token

If the returned region differs from the configured region, the client repeats the login against the reported region.

---

## Notes

Current observations have been verified against the implemented DREO Cloud communication flow.

## Verification

The login flow has been successfully verified against the official Dreo Cloud.

Verified components:

-   Request headers
-   Request body
-   MD5 password hashing
-   Timestamp query parameter
-   Authentication token
-   Region detection
