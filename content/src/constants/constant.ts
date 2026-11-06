import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ─── Environment & Data Source Mode Switchers ─────────────────────────────────
/**
 * Switch this flag:
 * true  -> Mock Data Mode (No backend or database needed; fully functional offline/mock data)
 * false -> Real Backend API Mode (Connects to live PHP backend & MySQL database)
 */
export const USE_MOCK_DATA = false;

// Switch this flag to true for Production Mode, and false for Local Development Mode
export const IS_PRODUCTION = true;
export const GOOGLE_MAPS_API_KEY = 'AIzaSyA1Kj7UYcHrOCsN2R4U-MWGijJj_DPLpH8'; //(saanvi Softgen Solution)

/**
 * Switch this flag:
 * true  -> Use Real Live Tracking Google Map (Real-time GPS tracking & Firebase sync)
 * false -> Use Normal Google Map (Static Store & User Delivery location pins with distance)
 */
export const USE_LIVE_TRACKING_MAP = false;


// Helper to determine the local base URL dynamically in development (using the developer's computer IP)
const getLocalIp = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  const ip = hostUri ? hostUri.split(':')[0] : 'localhost';

  if (ip === 'localhost') {
    return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  }
  return ip;
};

// Project / Store identifier
export const PROJECT_NAME = 'homebasket';

const LOCAL_IP = getLocalIp();

// ─── Local Configuration ──────────────────────────────────────────────────────
const LOCAL_CONFIG = {
  API_URL: `http://${LOCAL_IP}/MTB_Project/${PROJECT_NAME}/apps/delivery/Backend/api/`,
  IMAGE_BASE_URL: `http://${LOCAL_IP}/MTB_Project/${PROJECT_NAME}/portal/uploads/`,
  MAIL_URL: `http://${LOCAL_IP}/MTB_Project/${PROJECT_NAME}/portal/mail/send_generic_mail.php`,
};

// ─── Production Configuration ─────────────────────────────────────────────────
const PRODUCTION_CONFIG = {
  API_URL: `https://mtbstore.digitalbrightindia.cloud/${PROJECT_NAME}/apps/delivery/Backend/api/`,
  IMAGE_BASE_URL: `https://mtbstore.digitalbrightindia.cloud/${PROJECT_NAME}/portal/uploads/`,
  MAIL_URL: `https://mtbstore.digitalbrightindia.cloud/${PROJECT_NAME}/portal/mail/send_generic_mail.php`,
};

// Select the active configuration based on environment mode
const ACTIVE_CONFIG = IS_PRODUCTION ? PRODUCTION_CONFIG : LOCAL_CONFIG;

// Exported URLs
export const API_URL = ACTIVE_CONFIG.API_URL;
export const IMAGE_BASE_URL = ACTIVE_CONFIG.IMAGE_BASE_URL;
export const MAIL_URL = ACTIVE_CONFIG.MAIL_URL;

/**
 * Resolves full image URL for local dev (replaces localhost with device IP) and production
 */
export const resolveImageUrl = (img: string | null | undefined): string => {
  if (!img) return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop';
  if (typeof img !== 'string') return img;

  if (img.startsWith('http://') || img.startsWith('https://')) {
    if (img.includes('localhost') && LOCAL_IP && LOCAL_IP !== 'localhost') {
      return img.replace('localhost', LOCAL_IP);
    }
    return img;
  }
  const clean = img.startsWith('/') ? img.substring(1) : img;
  return `${IMAGE_BASE_URL}${clean}`;
};

// Common App constants
export const APP_VERSION = '1.0.0';
export const APP_NAME = 'HB Logistics';

// ─── Push Notification Constants ──────────────────────────────────────────────
export const NOTIFICATION_TARGETS = {
  USER: 'user',
  STORE: 'store',
  DELIVERY_PARTNER: 'delivery_partner',
  ADMIN: 'admin',
} as const;

export const NOTIFICATION_TYPES = {
  DELIVERY_ORDER: 'order',
  DELIVERY_PAYMENT: 'payment',
  DELIVERY_BONUS: 'bonus',
  DELIVERY_SYSTEM: 'system',
} as const;

export type NotificationTarget = typeof NOTIFICATION_TARGETS[keyof typeof NOTIFICATION_TARGETS];
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
