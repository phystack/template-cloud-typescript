# Cloud App (TypeScript)

A Phystack cloud app — a server-side service that connects to PhyHub via
`@phystack/hub-client` (cloud-app branch), receives operator-configured
settings on the connected Cloud twin's `desired.settings` map, and emits
analytics events back to PhyHub.

## Setup

```bash
cp .env.example .env
# fill in APP_ID, APP_SECRET (from `phy app create`), CORE_API_URL, and PHYHUB_URL
bun install
bun dev
```

## Connection model

The same SDK that runs on edge/screen/peripheral apps powers cloud apps —
only the constructor variant differs:

```ts
const client = await PhyHubClient.connect({
  cloudApp: {
    appId,        // from `phy app create`
    appSecret,
    coreApiUrl,   // gateway, e.g. https://api.phystack.com or http://localhost:14080
    phyhubUrl,    // phyhub, e.g. https://phyhub.eu.omborigrid.net or http://localhost:14400
  },
});
```

The SDK exchanges `{ appId, appSecret }` for a short-lived JWT via
`POST /api/2026-03/cloud-apps/:appId/token`, opens one Socket.IO connection
per Gridapp with the JWT as handshake auth, and auto-refreshes the JWT
60 seconds before it expires.

## What's in here

| File | Purpose |
|------|---------|
| `src/index.ts` | Entrypoint — connects via PhyHubClient, applies settings from twins, ticks events |
| `schema.json` | Operator-editable settings schema (rendered by Console) |
| `meta-schema.json` | UI hints for the settings form |
| `analytics-schema.json` | Event types this app emits |
| `manifest.json` | App-store metadata |

## Resilience contract

Persist the latest `CloudTwinResponse` to your own store on **every**
`onCloudTwinUpdated`/`onCloudTwinCreated` callback and operate from your own
store at runtime. The SDK delivers settings; it does not own settings state.
A PhyHub outage must not lose your configuration.
