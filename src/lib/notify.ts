import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Bridge } from './bridge';
import { DEMO_HOST } from './demo';
import type { Settings } from './settings';
import { addressesFor, tokenFor } from './settings';

/**
 * Notifications when a turn finishes.
 *
 * The push itself is empty. The bridge asks the delivery service to wake this
 * phone and nothing more; the phone then reads the session title and the reply
 * straight from the bridge on your own network, and raises the notification
 * locally. Session text never goes through anyone else.
 */

// A woken app shows its own notification, so the system should not also show
// one for the silent push that woke it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type TurnPayload = { host?: string; sessionId?: string; title?: string };

export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators get no push token
  const existing = await Notifications.getPermissionsAsync();
  const granted =
    existing.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('turns', {
      name: 'Finished turns',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return token.data;
}

/** Tell a computer where to wake this phone. */
export async function registerDevice(settings: Settings, pushToken: string): Promise<void> {
  const host = settings.bridgeHost;
  if (!host || host === DEMO_HOST) return;
  await new Bridge(host, tokenFor(settings, host)).registerDevice(pushToken);
}

/**
 * A turn finished somewhere. Read what happened from the bridge that sent the
 * wake-up, then say it locally.
 */
export async function announceTurn(settings: Settings, payload: TurnPayload): Promise<void> {
  const { sessionId } = payload;
  let title = payload.title?.trim() || 'Aside finished a turn';
  let body = 'Tap to read the reply.';

  if (sessionId) {
    // The push carries no content, so the detail comes from the bridge itself.
    const candidates = addressesFor(settings, settings.bridgeHost);
    for (const host of candidates) {
      try {
        const bridge = new Bridge(host, tokenFor(settings, host));
        const health = await bridge.health();
        if (!health.ok) continue;
        const { Aside } = await import('./aside');
        const aside = new Aside({ ...settings, bridgeHost: host });
        const meta = await aside.sessionMeta(sessionId);
        if (meta.title) title = meta.title;
        const items = await aside.transcript(sessionId);
        const last = [...items].reverse().find((i) => i.kind === 'text');
        if (last && last.kind === 'text') body = last.text.replace(/\s+/g, ' ').slice(0, 240);
        break;
      } catch {
        // try the next address
      }
    }
  }

  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { sessionId }, sound: false },
    trigger: null,
  });
}
