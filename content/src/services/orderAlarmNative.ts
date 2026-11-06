import { NativeModules, Platform } from 'react-native';

interface OrderAlarmNativeInterface {
  playAlarm(soundName?: string): Promise<boolean>;
  stopAlarm(): Promise<boolean>;
  wakeScreen(): Promise<boolean>;
  isDeviceLocked(): Promise<boolean>;
  getInitialOrderAlert(): Promise<Record<string, string> | null>;
}

const { OrderAlarmModule } = NativeModules as {
  OrderAlarmModule?: OrderAlarmNativeInterface;
};

export const OrderAlarm = {
  /**
   * Starts playing high-priority looping alarm sound through Android USAGE_ALARM stream.
   * Wakes the screen and bypasses device silent / vibrate switch.
   */
  startAlarm: async (soundName?: string): Promise<boolean> => {
    if (Platform.OS === 'android' && OrderAlarmModule?.playAlarm) {
      try {
        return await OrderAlarmModule.playAlarm(soundName);
      } catch (err) {
        console.warn('[OrderAlarm] Native playAlarm failed:', err);
        return false;
      }
    }
    return false;
  },

  /**
   * Immediately stops looping alarm sound and releases audio hardware.
   */
  stopAlarm: async (): Promise<boolean> => {
    if (Platform.OS === 'android' && OrderAlarmModule?.stopAlarm) {
      try {
        return await OrderAlarmModule.stopAlarm();
      } catch (err) {
        console.warn('[OrderAlarm] Native stopAlarm failed:', err);
        return false;
      }
    }
    return false;
  },

  /**
   * Wakes the device screen up and turns it on for 15 seconds.
   */
  wakeScreen: async (): Promise<boolean> => {
    if (Platform.OS === 'android' && OrderAlarmModule?.wakeScreen) {
      try {
        return await OrderAlarmModule.wakeScreen();
      } catch (err) {
        console.warn('[OrderAlarm] Native wakeScreen failed:', err);
        return false;
      }
    }
    return false;
  },

  /**
   * Checks if device is currently locked.
   */
  isDeviceLocked: async (): Promise<boolean> => {
    if (Platform.OS === 'android' && OrderAlarmModule?.isDeviceLocked) {
      try {
        return await OrderAlarmModule.isDeviceLocked();
      } catch {
        return false;
      }
    }
    return false;
  },

  /**
   * Fetches incoming order alert payload from Android Intent extras (when launched from lockscreen or notification tap).
   */
  getInitialOrderAlert: async (): Promise<Record<string, string> | null> => {
    if (Platform.OS === 'android' && OrderAlarmModule?.getInitialOrderAlert) {
      try {
        return await OrderAlarmModule.getInitialOrderAlert();
      } catch (err) {
        console.warn('[OrderAlarm] getInitialOrderAlert failed:', err);
        return null;
      }
    }
    return null;
  },
};

export default OrderAlarm;

