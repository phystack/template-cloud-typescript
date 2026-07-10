# template-cloud-typescript

Starter template for PhyStack **CLOUD** apps — server-side services that
connect to PhyHub via `@phystack/hub-client`, receive operator-configured
settings through Cloud twin desired properties, and emit analytics events
back. Scaffolded by the PhyStack CLI (`phy app init --type cloud`) or usable
directly.

Unlike edge apps, which run as containers on devices, a cloud app runs as a
single standalone process and serves all installations of the app across
every tenant. This template does not deploy anywhere on its own — you host
the process.

## Getting started

```bash
# Scaffold via the PhyStack CLI
phy app init my-cloud-app --type cloud

# Or work directly from this template
bun install
bun run build
```

## Configure credentials

```bash
phy app create my-cloud-app --type cloud   # register (once) — prints one-time credentials
cp .env.example .env                       # fill in the PHYSTACK_* variables
```

## Run locally

```bash
bun run dev
```

Bun auto-loads `.env` and `--watch` restarts on file changes. There is no
simulator involved — cloud apps talk to PhyHub directly.

## Flow

```bash
# 1. Edit src/schema.ts (settings), src/analytics-schema.ts (events), src/index.ts (logic)
# 2. Local build: compile TypeScript + generate schemas into build/
bun run build

# 3. Submit + publish the build (no container image for cloud apps)
bun run pub
```

`pub` runs `phy app build create $npm_package_name --dir . --publish`.

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Run locally with auto-reload (`bun --watch src/index.ts`, loads `.env`) |
| `bun run start` | Run the compiled app (`node dist/index.js`) |
| `bun run build` | Compile TypeScript (`tsc`) + `bun run schema` |
| `bun run schema` | Generate `build/schema.json` + `build/analytics-schema.json`, copy `manifest.json` |
| `bun run lint` | Type-check without emitting (`tsc --noEmit`) |
| `bun run pub` | Build, then submit + publish via the `phy` CLI |

## Connection model

The same SDK that runs on edge/screen/peripheral apps powers cloud apps —
only the constructor variant differs:

```ts
const client = await PhyHubClient.connect({
  cloudApp: {
    appRegistrationId,  // from `phy app create`
    appSecret,
    coreApiUrl,         // your regional core API (local dev: http://localhost:14080)
    phyhubUrl,          // your regional PhyHub (local dev: http://localhost:14400)
  },
});
```

The SDK exchanges `{ appRegistrationId, appSecret }` for a short-lived JWT,
opens one Socket.IO connection per app, and auto-refreshes the token before
expiry.

## Twin lifecycle

Cloud apps receive twins via the `cloudAppAuthenticated` event on connect
and through lifecycle callbacks:

- **`onCloudTwinUpdated`** — fired when a twin is created or its settings change
- **`onCloudTwinDeleted`** — fired when a twin is deactivated

Each twin represents one (installation, space) pair. A cloud app can serve
multiple twins simultaneously.

## Layout

| Path | Purpose |
|------|---------|
| `src/index.ts` | Entrypoint — connects to PhyHub, manages twins, emits events |
| `src/schema.ts` | Operator-editable settings schema (TypeScript → JSON Schema) |
| `src/analytics-schema.ts` | Event types this app emits |
| `manifest.json` | App kind and runtime metadata |
| `.env.example` | Required environment variables |

## Related documentation

- [Settings Schemas](https://build.phystack.com/phystack-concepts/settings-schemas/) — how settings and schemas work
- [Dev Environment Setup](https://build.phystack.com/getting-started/dev-environment-setup/) — CLI installation and setup
