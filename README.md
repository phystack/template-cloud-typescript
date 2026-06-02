# template-cloud

Starter template for scaffolding new cloud apps on the PhyStack platform.

## Overview

This repository is a project template used by `@phystack/cli` to scaffold new cloud apps. Cloud apps are server-side services that connect to PhyHub via `@phystack/hub-client`, receive operator-configured settings through Cloud twin desired properties, and can emit analytics events back to PhyHub.

Unlike edge apps which run as Docker containers on devices, cloud apps run as standalone processes and connect to PhyHub over Socket.IO. A single cloud-app process serves all installations of a Gridapp across every tenant.

This template does not deploy anywhere on its own.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun / Node.js 24 |
| Language | TypeScript 5.9 |
| Platform client | @phystack/hub-client |
| Schema generation | @phystack/ts-schema |

## Prerequisites

- Bun 1.x+ (or Node.js 24+)
- `@phystack/cli` installed globally (`npm i -g @phystack/cli`)

## Getting Started

This template is used automatically when you create a new cloud app with the CLI:

```bash
phy app create
```

Select **Cloud Application (TypeScript)** when prompted. The CLI will scaffold a new project from this template and display your one-time credentials.

### Configure Credentials

```bash
cp .env.example .env
```

Fill in the `PHYSTACK_*` variables from the CLI output.

### Run Locally

```bash
bun install
bun dev
```

Bun auto-loads `.env` and `--watch` restarts on file changes.

### Build and Publish

Build the `.gridapp` package:

```bash
bun run build
```

Publish to your tenant:

```bash
bun run pub
```

## Project Structure

```
src/
  index.ts              # Entry point -- connects to PhyHub, manages twins, emits events
  schema.ts             # TypeScript type for console-managed settings
  analytics-schema.ts   # Event types this app emits
manifest.json           # App kind and runtime metadata
tsconfig.json           # TypeScript compiler configuration
.env.example            # Template for required environment variables
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun dev` | Run the app locally with auto-reload (loads `.env` automatically) |
| `bun start` | Run the compiled app (`node dist/index.js`) |
| `bun run build` | Compile TypeScript, generate schemas, and package the `.gridapp` |
| `bun run lint` | Type-check without emitting (`tsc --noEmit`) |
| `bun run pub` | Publish the `.gridapp` to your tenant |

## Connection Model

The same SDK that runs on edge/screen/peripheral apps powers cloud apps -- only the constructor variant differs:

```ts
const client = await PhyHubClient.connect({
  cloudApp: {
    appRegistrationId,  // from `phy app create`
    appSecret,
    coreApiUrl,         // e.g. https://api.phystack.com
    phyhubUrl,          // e.g. https://phyhub.eu.omborigrid.net
  },
});
```

The SDK exchanges `{ appRegistrationId, appSecret }` for a short-lived JWT, opens one Socket.IO connection per Gridapp, and auto-refreshes the token before expiry.

## Twin Lifecycle

Cloud apps receive twins via the `cloudAppAuthenticated` event on connect and through lifecycle callbacks:

- **`onCloudTwinUpdated`** -- fired when a twin is created or its settings change
- **`onCloudTwinDeleted`** -- fired when a twin is deactivated

Each twin represents one (installation, space) pair. A cloud app can serve multiple twins simultaneously.

## Related Documentation

- [Settings Schemas](https://build.phystack.com/phystack-concepts/settings-schemas/) -- how settings and schemas work
- [Dev Environment Setup](https://build.phystack.com/getting-started/dev-environment-setup/) -- CLI installation and setup
