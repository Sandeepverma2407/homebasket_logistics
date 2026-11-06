import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppNotification {
  id: string;
  type: 'order' | 'payment' | 'bonus' | 'system';
  title: string;
  body: string;
  time: string;
  timestamp: number;
  unread: boolean;
  orderData?: any;
}

const STORAGE_KEY = '@saved_notifications';

export async function getSavedNotifications(): Promise<AppNotification[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (json) {
      const parsed: AppNotification[] = JSON.parse(json);
      return parsed;
    }
  } catch (e) {
    console.error('Error loading notifications:', e);
  }
  return [];
}

export async function saveNotification(
  notification: Omit<AppNotification, 'id' | 'timestamp' | 'unread'> & {
    id?: string;
    timestamp?: number;
    unread?: boolean;
  }
): Promise<AppNotification[]> {
  try {
    const existing = await getSavedNotifications();
    const newNotif: AppNotification = {
      id: notification.id || String(Date.now()),
      type: notification.type || 'order',
      title: notification.title || 'Notification',
      body: notification.body || '',
      time: notification.time || 'Just now',
      timestamp: notification.timestamp || Date.now(),
      unread: notification.unread !== undefined ? notification.unread : true,
      orderData: notification.orderData,
    };

    // Avoid duplicate IDs
    const filtered = existing.filter((item) => item.id !== newNotif.id);
    const updated = [newNotif, ...filtered];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error saving notification:', e);
    return [];
  }
}

export async function markAllNotificationsRead(): Promise<AppNotification[]> {
  try {
    const existing = await getSavedNotifications();
    const updated = existing.map((n) => ({ ...n, unread: false }));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error marking notifications read:', e);
    return [];
  }
}

export async function toggleNotificationRead(id: string): Promise<AppNotification[]> {
  try {
    const existing = await getSavedNotifications();
    const updated = existing.map((n) => (n.id === id ? { ...n, unread: false } : n));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error toggling notification read:', e);
    return [];
  }
}

export async function clearAllNotifications(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  } catch (e) {
    console.error('Error clearing notifications:', e);
  }
}
