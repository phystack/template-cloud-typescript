# CLAUDE.md — template-cloud-typescript

Starter template for PhyStack **CLOUD** apps: a single server-side process
(Bun/Node + TypeScript) that connects to PhyHub through
`@phystack/hub-client` and serves **all installations of the app across
every tenant** via Cloud twins. Scaffolded by
`phy app init <name> --type cloud` (or `--lang ts` explicitly).

## Commands (bun-only — no npm/yarn scripts)

| Command | What it runs |
|---|---|
| `bun install` | Install dependencies |
| `bun run dev` | `bun --watch src/index.ts` — auto-reload, `.env` auto-loaded |
| `bun run start` | `node dist/index.js` — run the compiled app |
| `bun run build` | `tsc` + `bun run schema` |
| `bun run schema` | `build/schema.json` + `build/analytics-schema.json` (+ copy `manifest.json`) |
| `bun run lint` | `tsc --noEmit` |
| `bun run pub` | `bun run build && phy app build create $npm_package_name --dir . --publish` |

## Dev loop

- No device simulator — cloud apps connect straight to PhyHub. Credentials
  live in `.env` (copy from `.env.example`): `PHYSTACK_APP_REGISTRATION_ID`,
  `PHYSTACK_APP_SECRET` (printed once by `phy app create`),
  `PHYSTACK_CORE_API_URL`, `PHYSTACK_PHYHUB_URL`, `PHYSTACK_REGION`.
- Local platform defaults: core API `http://localhost:14080`, PhyHub
  `http://localhost:14400`.

## Connection model

`PhyHubClient.connect({ cloudApp: { appRegistrationId, appSecret,
coreApiUrl, phyhubUrl } })` — the SDK exchanges the secret for a short-lived
JWT, opens one Socket.IO connection, and auto-refreshes the token. Twins
arrive via the `cloudAppAuthenticated` event on connect, then
`onCloudTwinUpdated` (created or settings changed) and `onCloudTwinDeleted`
(deactivated). Each twin is one (installation, space) pair; one process
serves many twins.

## Publish flow (new `phy` CLI grammar)

```bash
phy login
phy app create <name> --type cloud   # register (once), prints one-time credentials
bun run pub                          # build, submit + publish (no container image)
```

Publishing ships the schemas + manifest so the Console can render settings;
the process itself is hosted by you. The legacy `@phystack/cli` (Node) does
not work with this template — use the Rust `phy` CLI only.

## Layout

| Path | Purpose |
|---|---|
| `src/index.ts` | Entrypoint — PhyHub connection, twin lifecycle, event emission |
| `src/schema.ts` | Operator-editable settings schema source |
| `src/analytics-schema.ts` | Event types this app emits |
| `manifest.json` | App kind + runtime metadata (copied into `build/`) |
| `.env.example` | Required environment variables |

## Gotchas

- `application-type` in package.json must stay `cloud`; the package.json
  `name` is the app name used by `pub` (`$npm_package_name`).
- Settings state belongs to you: persist twin settings to your own store on
  every update and operate from that store — the connection delivers
  updates, it does not own state.
- Rust sibling: [template-cloud-rust](https://github.com/phystack/template-cloud-rust)
  implements the same contract with raw HTTPS calls (no SDK crate exists).
