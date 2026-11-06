import { 
  IS_PRODUCTION, 
  USE_MOCK_DATA,
  API_URL, 
  IMAGE_BASE_URL, 
  MAIL_URL 
} from '../constants/constant';
import { installMockInterceptor } from '../mock/mockInterceptor';

export const CONFIG = {
  // Current environment mode (boolean flag)
  IS_PRODUCTION,
  
  // Data Source Switch: true = Use Mock Data (offline/local), false = Use Real PHP API & DB
  USE_MOCK_DATA,

  // Base configuration
  BASE_URL: API_URL,
  TIMEOUT: 10000, // 10 seconds request timeout
  
  // Global network headers
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  
  // Fully resolved API Endpoints organized screen-wise
  ENDPOINTS: {
    // ── Auth Screen ──────────────────────────────────────────────────────────
    LOGIN: `${API_URL}auth/login.php`,
    SEND_OTP: `${API_URL}auth/send_otp.php`,
    VERIFY_OTP: `${API_URL}auth/verify_otp.php`,
    LOGOUT: `${API_URL}auth/logout.php`,

    // ── Home Screen ──────────────────────────────────────────────────────────
    GET_HOME_STATS: `${API_URL}home/home_stats.php`,
    TOGGLE_STATUS: `${API_URL}home/toggle_status.php`,
    ACCEPT_DELIVERY_JOB: `${API_URL}home/accept_delivery_job.php`,

    // ── Orders Screen ────────────────────────────────────────────────────────
    ORDERS: `${API_URL}orders/get_delivery_jobs.php`,
    GET_DELIVERY_JOBS: `${API_URL}orders/get_delivery_jobs.php`,

    // ── Active Delivery Screen (Arrived, Map, Complete) ──────────────────────
    UPDATE_JOB_STATUS: `${API_URL}delivery/update_job_status.php`,
    UPDATE_ITEM_PICKED: `${API_URL}delivery/update_item_picked.php`,

    // ── Earnings Screen ──────────────────────────────────────────────────────
    EARNINGS: `${API_URL}earnings/earnings.php`,
    WITHDRAW: `${API_URL}earnings/withdraw.php`,
    DEPOSIT: `${API_URL}earnings/deposit.php`,
    GET_EARNINGS_TRANSACTIONS: `${API_URL}earnings/get_earnings_transactions.php`,

    // ── Profile & Settings Screen ────────────────────────────────────────────
    PROFILE: `${API_URL}profile/profile.php`,
    UPDATE_PROFILE_PHOTO: `${API_URL}profile/update_profile_photo.php`,
    GET_ACCOUNT_SETTINGS: `${API_URL}profile/get_account_settings.php`,
    SAVE_BANK_DETAILS: `${API_URL}profile/save_bank_details.php`,
    SAVE_KYC_DOCUMENT: `${API_URL}profile/save_kyc_document.php`,
    UPDATE_FCM_TOKEN: `${API_URL}profile/update_fcm_token.php`,
    UPDATE_LOCATION: `${API_URL}profile/location/update`,
    NOTIFICATIONS: `${API_URL}profile/notifications`,
  },
  
  // Contact mail base link resolved for active environment
  MAIL_LINK: MAIL_URL,
  
  // Images base link URL
  IMAGE_BASE_URL: IMAGE_BASE_URL,
} as const;

export default CONFIG;

// Automatically initialize network mock interceptor when configured
installMockInterceptor(
  () => CONFIG.USE_MOCK_DATA,
  () => CONFIG.BASE_URL
);
