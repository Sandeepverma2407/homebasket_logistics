import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, PermissionsAndroid, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../connection/config';

// Detect if app is running inside Expo Go client
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
    if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch (e) {
    console.log('[FCM] expo-notifications is unavailable in this environment');
  }
}

export interface SoundConfig {
  key: string;
  channelId: string;
  soundFile: string;
  name: string;
}

const ORDER_CHANNEL_VERSION = 'v5';

export const SOUND_CONFIGS: SoundConfig[] = [
  { key: 'Classic Bell', channelId: 'order_alerts_v5_classic_bell', soundFile: 'classic_bell.mp3', name: 'Order Alert - Classic Bell 🔔' },
  { key: 'Alarm Ring', channelId: 'order_alerts_v5_alarm_ring', soundFile: 'alarm_ring.mp3', name: 'Order Alert - Alarm Ring ⏰' },
  { key: 'Mysterious', channelId: 'order_alerts_v5_mysterious', soundFile: 'mysterious.mp3', name: 'Order Alert - Mysterious 🎵' },
  { key: 'Siren Alert', channelId: 'order_alerts_v5_siren_alert', soundFile: 'siren_alert.mp3', name: 'Order Alert - Siren Alert 🚨' },
  { key: 'Techno Alert', channelId: 'order_alerts_v5_techno_alert', soundFile: 'techno_alert.mp3', name: 'Order Alert - Techno Alert ⚡' },
];

/**
 * Creates high-priority Android Notification Channels for each custom alarm sound.
 * Registers both order_channel_v5_* and order_alerts_v5_* so push notifications
 * from store backend, admin panel, or delivery backend all trigger the loud alarm.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (isExpoGo || !Notifications || Platform.OS !== 'android') return;

  try {
    // 1. Versioned fallback channel. Android does not allow changing a channel's
    // sound after creation, so bump this ID whenever the alarm behavior changes.
    await Notifications.setNotificationChannelAsync(`order_channel_${ORDER_CHANNEL_VERSION}_default`, {
      name: 'New Order Alerts 🚨 (Default)',
      description: 'Loud alarm alerts for incoming orders when app is open or closed',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 600, 300, 600, 300, 600],
      lightColor: '#00C896',
      sound: 'alarm_ring.mp3',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
      showBadge: true,
      enableVibrate: true,
      enableLights: true,
    });

    // 2. Default order_alerts fallback Channel
    await Notifications.setNotificationChannelAsync(`order_alerts_${ORDER_CHANNEL_VERSION}`, {
      name: 'Order Alerts (Loud Alarm)',
      description: 'Loud alarm alerts for incoming orders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 600, 300, 600, 300, 600],
      lightColor: '#00C896',
      sound: 'alarm_ring.mp3',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
      showBadge: true,
      enableVibrate: true,
      enableLights: true,
    });

    // 3. Register individual channels for each selectable sound under both namespaces:
    //    a) order_alerts_* (used by delivery backend)
    //    b) order_channel_v5_* (used by store app backend and admin panel)
    for (const sc of SOUND_CONFIGS) {
      // order_alerts_*
      await Notifications.setNotificationChannelAsync(sc.channelId, {
        name: sc.name,
        description: 'Order alert sound: ' + sc.key,
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 600, 300, 600, 300, 600],
        lightColor: '#00C896',
        sound: sc.soundFile,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          flags: {
            enforceAudibility: true,
            requestHardwareAudioVideoSynchronization: false,
          },
        },
        showBadge: true,
        enableVibrate: true,
        enableLights: true,
      });

      // order_channel_v5_*
      const soundKey = sc.channelId.replace(`order_alerts_${ORDER_CHANNEL_VERSION}_`, '');
      const v5ChannelId = `order_channel_${ORDER_CHANNEL_VERSION}_${soundKey}`;
      await Notifications.setNotificationChannelAsync(v5ChannelId, {
        name: sc.name + ' (v5)',
        description: 'Order alert sound: ' + sc.key,
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 600, 300, 600, 300, 600],
        lightColor: '#00C896',
        sound: sc.soundFile,
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          flags: {
            enforceAudibility: true,
            requestHardwareAudioVideoSynchronization: false,
          },
        },
        showBadge: true,
        enableVibrate: true,
        enableLights: true,
      });
    }

    // 4. Also register order_channel_v5_order_ring alias
    await Notifications.setNotificationChannelAsync(`order_channel_${ORDER_CHANNEL_VERSION}_order_ring`, {
      name: 'Order Alert - Order Ring ⏰',
      description: 'Loud alarm alerts for incoming orders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 600, 300, 600, 300, 600],
      lightColor: '#00C896',
      sound: 'alarm_ring.mp3',
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
      showBadge: true,
      enableVibrate: true,
      enableLights: true,
    });

    // 5. General Alerts Channel
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General Notifications',
      description: 'Account and status notifications',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00C896',
      sound: 'default',
      showBadge: true,
    });

    // 6. Delivery Status Update Channel (normal sound, no alarm)
    await Notifications.setNotificationChannelAsync('delivery_status_update', {
      name: 'Delivery Status Updates',
      description: 'Normal notifications for delivery partner status updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00C896',
      sound: 'default',
      bypassDnd: false,
      showBadge: true,
      enableVibrate: true,
    });

    console.log('[FCM] All sound notification channels configured successfully');
  } catch (error) {
    console.error('[FCM] Error setting up notification channels:', error);
  }
}

/**
 * Checks all permissions critical for background order alarms:
 * - Push Notifications permission
 * - Channels status
 */
export async function checkNotificationPermissions(): Promise<{
  notificationsGranted: boolean;
  canAskAgain: boolean;
  channelsReady: boolean;
}> {
  if (Platform.OS !== 'android') return { notificationsGranted: true, canAskAgain: true, channelsReady: true };
  if (!Notifications) return { notificationsGranted: false, canAskAgain: false, channelsReady: false };

  try {
    let notificationsGranted = false;
    let canAskAgain = true;

    if (Platform.Version >= 33) {
      notificationsGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    } else {
      const { status, canAskAgain: canAsk } = await Notifications.getPermissionsAsync();
      notificationsGranted = status === 'granted';
      canAskAgain = canAsk;
    }

    const channel = await Notifications.getNotificationChannelAsync(`order_alerts_${ORDER_CHANNEL_VERSION}`);
    const channelsReady = !!channel && channel.importance >= Notifications.AndroidImportance.HIGH;

    return { notificationsGranted, canAskAgain, channelsReady };
  } catch (e) {
    return { notificationsGranted: false, canAskAgain: false, channelsReady: false };
  }
}

/**
 * Open App Settings so user can enable notifications / full screen alerts / battery unrestricted.
 */
export function openNotificationSettings(): void {
  if (Platform.OS === 'android') {
    Linking.openSettings();
  }
}

/**
 * Request notification permissions again interactively
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android' || !Notifications) return true;

  try {
    if (Platform.Version >= 33) {
      const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (res === PermissionsAndroid.RESULTS.GRANTED) {
        await setupNotificationChannels();
        return true;
      }
    } else {
      const res = await Notifications.requestPermissionsAsync();
      if (res.status === 'granted') {
        await setupNotificationChannels();
        return true;
      }
    }
  } catch (e) {
    console.error('Error requesting permissions:', e);
  }

  // If system dialog did not grant, open App Settings
  Linking.openSettings();
  return false;
}

/**
 * Initializes FCM token, requests push notification permissions,
 * and saves the FCM token + sound preference into the database.
 */
export async function registerAndSyncFcmToken(partnerId: number): Promise<string | null> {
  if (!partnerId) return null;

  if (isExpoGo || !Notifications) {
    console.log('[FCM] Notifications module bypassed (Expo Go mode)');
    return null;
  }

  try {
    await setupNotificationChannels();

    let hasPermission = false;
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        hasPermission = true;
      }
    } else {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      hasPermission = finalStatus === 'granted';
    }

    if (!hasPermission) {
      console.log('[FCM] Push notification permission not granted by user');
      return null;
    }

    let fcmToken = '';
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      if (deviceToken && deviceToken.data) {
        fcmToken = typeof deviceToken.data === 'string' ? deviceToken.data : JSON.stringify(deviceToken.data);
      }
    } catch (e) {
      console.log('[FCM] Native device push token fetch error:', e);
    }

    if (!fcmToken) {
      try {
        const expoToken = await Notifications.getExpoPushTokenAsync();
        if (expoToken && expoToken.data) {
          fcmToken = expoToken.data;
        }
      } catch (e) {
        console.log('[FCM] Expo push token fetch error:', e);
      }
    }

    if (!fcmToken) {
      console.log('[FCM] Failed to retrieve valid FCM token');
      return null;
    }

    const savedSound = (await AsyncStorage.getItem('order_alert_sound')) || 'Classic Bell';

    // Save FCM token + sound preference in database
    await fetch(CONFIG.ENDPOINTS.UPDATE_FCM_TOKEN, {
      method: 'POST',
      headers: CONFIG.HEADERS,
      body: JSON.stringify({
        partner_id: partnerId,
        fcm_id: fcmToken,
        Fcm_Id: fcmToken,
        sound_preference: savedSound,
      }),
    });

    return fcmToken;
  } catch (error) {
    console.error('[FCM] Error in registerAndSyncFcmToken:', error);
    return null;
  }
}

/**
 * Updates sound preference on the backend server for this delivery partner
 */
export async function syncSoundPreferenceToServer(partnerId: number, soundName: string): Promise<void> {
  if (!partnerId) return;
  try {
    await fetch(CONFIG.ENDPOINTS.UPDATE_FCM_TOKEN, {
      method: 'POST',
      headers: CONFIG.HEADERS,
      body: JSON.stringify({
        partner_id: partnerId,
        sound_preference: soundName,
      }),
    });
  } catch (e) {
    console.log('[FCM] Failed to sync sound preference to server:', e);
  }
}
