import {
  PhyHubClient,
  type CloudTwinResponse,
  type CloudTwinLifecycleEvent,
} from '@phystack/hub-client';
import type { Settings } from './schema';

const DEFAULT_SETTINGS: Settings = { eventNames: ['CLOUD_PING'], frequencyMs: 5_000 };

interface TwinState {
  twin: CloudTwinResponse;
  settings: Settings;
  nextEventIndex: number;
  tickHandle: ReturnType<typeof setInterval>;
}

function ts(): string {
  return new Date().toISOString();
}

function twinTag(twin: CloudTwinResponse): string {
  return `[twin:${twin.deviceId}]`;
}

function log(level: 'info' | 'warn' | 'error', ...args: unknown[]): void {
  console[level](`${ts()}`, ...args);
}

const config = {
  appRegistrationId: process.env.PHYSTACK_APP_REGISTRATION_ID ?? '',
  appSecret: process.env.PHYSTACK_APP_SECRET ?? '',
  coreApiUrl: process.env.PHYSTACK_CORE_API_URL ?? 'http://localhost:14080',
  phyhubUrl: process.env.PHYSTACK_PHYHUB_URL ?? 'http://localhost:14400',
};

const region = process.env.PHYSTACK_REGION ?? 'LOCAL';

if (!config.appRegistrationId || !config.appSecret) {
  console.error('PHYSTACK_APP_REGISTRATION_ID and PHYSTACK_APP_SECRET must be set (see .env.example)');
  process.exit(1);
}

(async () => {
  log('info', '[lifecycle] connecting to PhyHub...', { phyhubUrl: config.phyhubUrl, appId: config.appRegistrationId });

  const client = await PhyHubClient.connect({ cloudApp: config });

  log('info', '[lifecycle] connected to PhyHub', { phyhubUrl: config.phyhubUrl, appId: config.appRegistrationId });

  const twins = new Map<string, TwinState>();

  function parseSettings(twin: CloudTwinResponse): Settings {
    const raw = (twin.properties?.desired?.settings ?? {}) as Partial<Settings>;
    const settings: Settings = { ...DEFAULT_SETTINGS };
    if (Array.isArray(raw.eventNames) && raw.eventNames.length > 0) {
      settings.eventNames = raw.eventNames;
    }
    if (typeof raw.frequencyMs === 'number' && raw.frequencyMs > 0) {
      settings.frequencyMs = raw.frequencyMs;
    }
    return settings;
  }

  function startTick(state: TwinState): ReturnType<typeof setInterval> {
    const { twin, settings } = state;
    const tag = twinTag(twin);
    log('info', `${tag} [tick] starting interval`, { frequencyMs: settings.frequencyMs, eventNames: settings.eventNames });

    return setInterval(() => {
      const eventName = settings.eventNames[state.nextEventIndex % settings.eventNames.length] ?? 'ping';
      state.nextEventIndex += 1;

      const payload = {
        deviceId: twin.deviceId,
        spaceId: twin.properties?.desired?.spaceId,
        tenantId: twin.tenantId,
        dataResidency: region,
        eventType: eventName,
        interaction: false,
        source: 'cloud-app-template',
      };

      try {
        client.sendEvent(eventName, payload);
        log('info', `${tag} [event] sent`, { eventName, index: state.nextEventIndex, payload });
      } catch (err) {
        log('warn', `${tag} [event] sendEvent failed`, { eventName, error: err });
      }
    }, settings.frequencyMs);
  }

  function addOrUpdateTwin(twin: CloudTwinResponse, reason: string): void {
    const tag = twinTag(twin);
    const existing = twins.get(twin.deviceId);

    log('info', `${tag} [lifecycle] full twin payload (${reason})`, JSON.stringify(twin, null, 2));

    if (existing) {
      clearInterval(existing.tickHandle);
      const settings = parseSettings(twin);
      existing.twin = twin;
      existing.settings = settings;
      existing.nextEventIndex = 0;
      existing.tickHandle = startTick(existing);
      log('info', `${tag} [lifecycle] twin updated — settings applied`, { settings });
    } else {
      const settings = parseSettings(twin);
      const state: TwinState = {
        twin,
        settings,
        nextEventIndex: 0,
        tickHandle: undefined!,
      };
      state.tickHandle = startTick(state);
      twins.set(twin.deviceId, state);
      log('info', `${tag} [lifecycle] twin added — total active: ${twins.size}`, { settings });
    }
  }

  function removeTwin(twin: CloudTwinResponse, reason: string): void {
    const tag = twinTag(twin);
    log('info', `${tag} [lifecycle] full twin payload (${reason})`, JSON.stringify(twin, null, 2));
    const existing = twins.get(twin.deviceId);
    if (existing) {
      clearInterval(existing.tickHandle);
      twins.delete(twin.deviceId);
      log('info', `${tag} [lifecycle] twin removed (${reason}) — total active: ${twins.size}`);
    } else {
      log('warn', `${tag} [lifecycle] received delete for unknown twin (${reason})`, { deviceId: twin.deviceId });
    }
  }

  // Hydrate from twins already delivered via cloudAppAuthenticated.
  const initialTwins = client.getCloudTwins();
  log('info', `[lifecycle] initial twin hydration — ${initialTwins.length} twin(s) received`);
  for (const twin of initialTwins) {
    addOrUpdateTwin(twin, 'initial hydration');
  }

  client.onCloudTwinUpdated((event: CloudTwinLifecycleEvent) => {
    addOrUpdateTwin(event.twin, 'onCloudTwinUpdated');
  });

  client.onCloudTwinDeleted((event: CloudTwinLifecycleEvent) => {
    removeTwin(event.twin, 'onCloudTwinDeleted');
  });

  // Periodic summary of active twins for observability.
  setInterval(() => {
    const entries = [...twins.entries()].map(([deviceId, s]) => ({
      deviceId,
      twinId: s.twin.id,
      eventNames: s.settings.eventNames,
      frequencyMs: s.settings.frequencyMs,
      eventsSent: s.nextEventIndex,
    }));
    log('info', `[heartbeat] active twins: ${twins.size}`, { twins: entries });
  }, 30_000);

  log('info', '[lifecycle] app startup complete — listening for twin lifecycle events');
})().catch((err) => {
  log('error', '[lifecycle] cloud-app failed to start', err);
  process.exit(1);
});
