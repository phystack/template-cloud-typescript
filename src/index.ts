// Cloud App entrypoint.
//
// Receives operator-configured settings (delivered via the connected Cloud
// twin's desired.settings map) and emits analytics events back to PhyHub via
// the shared @phystack/hub-client SDK.
//
// The platform is the source of truth for settings; your service is the
// source of truth for everything else (data, state, runtime). Persist on
// every onCloudTwinUpdated callback so a PhyHub outage doesn't lose your
// config.

import {
  PhyHubClient,
  type CloudTwinResponse,
  type CloudTwinLifecycleEvent,
} from '@phystack/hub-client';

interface MySettings {
  /** Names of events the app emits. */
  eventNames: string[];
  /** Cadence in milliseconds. */
  frequencyMs: number;
}

const config = {
  appId: process.env.APP_ID ?? '',
  appSecret: process.env.APP_SECRET ?? '',
  coreApiUrl: process.env.CORE_API_URL ?? 'http://localhost:14080',
  phyhubUrl: process.env.PHYHUB_URL ?? 'http://localhost:14400',
};

if (!config.appId || !config.appSecret) {
  console.error('APP_ID and APP_SECRET must be set (see .env.example)');
  process.exit(1);
}

(async () => {
  const client = await PhyHubClient.connect({ cloudApp: config });
  console.info(`connected to ${config.phyhubUrl} as ${config.appId}`);

  let currentSettings: MySettings = { eventNames: ['ping'], frequencyMs: 5_000 };
  let nextEventIndex = 0;
  let tickHandle: ReturnType<typeof setInterval> | undefined;

  const scheduleTick = (): ReturnType<typeof setInterval> =>
    setInterval(() => {
      const twin = client.getCloudTwins()[0];
      if (!twin) return;
      const eventName =
        currentSettings.eventNames[nextEventIndex % currentSettings.eventNames.length] ??
        'ping';
      nextEventIndex += 1;
      try {
        client.sendEvent(eventName, {
          deviceId: twin.deviceId,
          spaceId: twin.properties?.desired?.spaceId,
          eventType: eventName,
          source: 'cloud-app-template',
        });
      } catch (err) {
        console.warn('emitEvent failed', err);
      }
    }, currentSettings.frequencyMs);

  const applySettings = (twin: CloudTwinResponse) => {
    const settings = (twin.properties?.desired?.settings ?? {}) as Partial<MySettings>;
    if (Array.isArray(settings.eventNames) && settings.eventNames.length > 0) {
      currentSettings.eventNames = settings.eventNames;
    }
    if (typeof settings.frequencyMs === 'number' && settings.frequencyMs > 0) {
      currentSettings.frequencyMs = settings.frequencyMs;
    }
    nextEventIndex = 0;
    console.info('settings updated', currentSettings);
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = scheduleTick();
  };

  // Hydrate from any twins delivered via cloudAppAuthenticated.
  const initialTwin = client.getCloudTwins()[0];
  if (initialTwin) applySettings(initialTwin);

  // React to lifecycle events for the same Gridapp's twins.
  client.onCloudTwinCreated((event: CloudTwinLifecycleEvent) => applySettings(event.twin));
  client.onCloudTwinUpdated((event: CloudTwinLifecycleEvent) => applySettings(event.twin));

  tickHandle = scheduleTick();
})().catch((err) => {
  console.error('cloud-app failed to start', err);
  process.exit(1);
});
