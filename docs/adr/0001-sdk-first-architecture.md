# ADR 0001: SDK-first architecture

## Status

Accepted

## Context

The project started with the goal of building an ioBroker adapter for Dreo devices. During setup, we decided to separate the reusable Dreo communication logic from the ioBroker-specific adapter logic.

## Decision

We will build the project as a monorepo with a reusable Dreo SDK as the core package.

The `dreo-api` package contains all Dreo-related communication, authentication, device models, commands and protocol handling.

The `iobroker.dreo` package will later use `dreo-api` instead of implementing Dreo logic directly.

## Consequences

This keeps the ioBroker adapter small and makes the Dreo SDK reusable for other projects such as CLI tools, dashboards, Homebridge, Node-RED or future integrations.

The SDK architecture is now considered stable for phase 1. Further structure changes should only be made when technically necessary.
