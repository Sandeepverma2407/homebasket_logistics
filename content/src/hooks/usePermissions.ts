import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, Platform, PermissionsAndroid } from 'react-native';

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// expo-notifications is not available in Expo Go (SDK 53+).
let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    // Unavailable
  }
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface PermissionsState {
  notification: PermissionStatus;
  location: PermissionStatus;
}

/**
 * Check notification permission status.
 * - Android: uses PermissionsAndroid (works in Expo Go).
 *   Android < 33 doesn't need runtime permission → always granted.
 * - iOS: uses expo-notifications (dev build only).
 */
async function checkNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // POST_NOTIFICATIONS is only required on Android 13+ (API 33+)
    if (Platform.Version >= 33) {
      const status = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      return status === true;
    }
    // Below Android 13: notifications are always allowed by default
    return true;
  }
  // iOS: rely on expo-notifications if in standalone / dev build
  if (Notifications) {
    const result = await Notifications.getPermissionsAsync();
    return result.status === 'granted';
  }
  return false;
}

/**
 * Request notification permission.
 * - Android: uses PermissionsAndroid (works in Expo Go).
 * - iOS: uses expo-notifications (dev build only).
 */
async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true; // Android < 13: always granted
  }
  // iOS
  if (Notifications) {
    const result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return result.status === 'granted';
  }
  return false;
}

/**
 * Requests notification + location permissions on first mount.
 * Returns live permission statuses for use across the app.
 * Works correctly in Expo Go on Android via PermissionsAndroid.
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<PermissionsState>({
    notification: 'undetermined',
    location: 'undetermined',
  });

  const checkAndRequestAll = useCallback(async () => {
    // ── Notifications ──────────────────────────────────────────────
    let notifStatus: PermissionStatus = 'undetermined';
    try {
      const alreadyGranted = await checkNotificationPermission();
      if (alreadyGranted) {
        notifStatus = 'granted';
      } else {
        const granted = await requestNotificationPermission();
        notifStatus = granted ? 'granted' : 'denied';
      }
    } catch (e) {
      notifStatus = 'denied';
    }

    // ── Location ───────────────────────────────────────────────────
    let locStatus: PermissionStatus = 'undetermined';
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      if (existing.status === 'granted') {
        locStatus = 'granted';
      } else if (existing.canAskAgain) {
        const result = await Location.requestForegroundPermissionsAsync();
        locStatus = result.status === 'granted' ? 'granted' : 'denied';
      } else {
        locStatus = 'denied';
      }
    } catch (e) {
      locStatus = 'denied';
    }

    setPermissions({ notification: notifStatus, location: locStatus });
  }, []);

  /**
   * Re-checks current permission statuses without prompting.
   * Called on every Settings screen focus so badges update live.
   */
  const recheckPermissions = useCallback(async () => {
    try {
      const notifGranted = await checkNotificationPermission();
      const loc = await Location.getForegroundPermissionsAsync();
      setPermissions({
        notification: notifGranted ? 'granted' : 'denied',
        location: loc.status === 'granted' ? 'granted' : 'denied',
      });
    } catch (e) {
      // silent
    }
  }, []);

  /** Opens the OS settings app so the user can manage permissions. */
  const openAppSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  useEffect(() => {
    checkAndRequestAll();
  }, [checkAndRequestAll]);

  return {
    permissions,
    isLocationGranted: permissions.location === 'granted',
    isNotificationGranted: permissions.notification === 'granted',
    recheckPermissions,
    openAppSettings,
  };
}
