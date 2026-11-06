import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useRouter } from 'expo-router';
import NewOrderModal from '../components/NewOrderModal';
import OrderAlarm from '../services/orderAlarmNative';
import { saveNotification } from '../services/notificationStorage';
import { useAuth } from './AuthContext';
import { CustomAlert as Alert } from '../components/CustomAlert';
import CONFIG from '../connection/config';

export interface OrderAlertData {
  id: number;
  job_id: number;
  custom_order_id: string;
  restaurant_name: string;
  restaurant_address: string;
  delivery_address: string;
  user_name: string;
  estimated_distance: string;
  payout_amount: string;
  commission_type?: string;
  status?: string;
  [key: string]: any;
}

interface OrderAlertContextType {
  showOrderAlert: (order: Partial<OrderAlertData>) => void;
  hideOrderAlert: () => void;
  isAlertVisible: boolean;
  currentOrder: OrderAlertData | null;
}

const OrderAlertContext = createContext<OrderAlertContextType | undefined>(undefined);

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: typeof import('expo-notifications') | null = null;
if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.log('[OrderAlertContext] expo-notifications unavailable');
  }
}

// In-memory cache for recent notification timestamps to deduplicate multi-events
const recentNotificationTimestamps = new Map<string, number>();

export function parseOrderFromPayload(data: any, title?: string, body?: string): OrderAlertData | null {
  if (!data) return null;

  const notifTypeStr = String(data.type || '').toLowerCase();
  const notifTargetStr = String(data.target || '').toLowerCase();
  const statusClean = String(data.status || 'pending').toUpperCase();
  const isAlertFlag = data.is_order_alert === '1';
  const titleLower = String(title || data.title || '').toLowerCase();

  const isOrder =
    isAlertFlag ||
    notifTypeStr === 'order' ||
    notifTypeStr === 'new_order' ||
    notifTypeStr === 'delivery' ||
    notifTypeStr === 'test' ||
    notifTargetStr === 'partner' ||
    notifTargetStr === 'delivery_partner' ||
    titleLower.includes('order') ||
    titleLower.includes('alert') ||
    Boolean(data.job_id || data.order_id || data.sub_order_id);

  if (!isOrder) return null;

  const rawJobId = data.job_id || data.id || data.order_id || data.sub_order_id;
  const jobId = rawJobId ? Number(rawJobId) : 9999;

  return {
    id: jobId,
    job_id: jobId,
    custom_order_id: data.sub_order_no || data.job_no || data.order_no || (jobId === 9999 ? '9999' : `${jobId}`),
    restaurant_name: data.store_name || data.shop_name || data.restaurant_name || 'Store Partner',
    restaurant_address: data.pickup_address || data.restaurant_address || 'Store Location',
    delivery_address: data.delivery_address || data.dropoff_address || 'Customer Delivery Address',
    user_name: data.customer_name || data.user_name || 'Customer',
    estimated_distance: data.estimated_distance || data.distance || '2.5',
    payout_amount: data.payout_amount || data.earning || data.amount || '45.00',
    commission_type: data.commission_type || 'fixed',
    status: statusClean || 'PENDING',
  };
}

export function OrderAlertProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [orderData, setOrderData] = useState<OrderAlertData | null>(null);
  const { partner } = useAuth();
  const router = useRouter();

  const showOrderAlert = (order: Partial<OrderAlertData>) => {
    const fullOrder: OrderAlertData = {
      id: Number(order.job_id || order.id || Date.now()),
      job_id: Number(order.job_id || order.id || Date.now()),
      custom_order_id: String(order.custom_order_id || order.job_no || order.id || 'NEW'),
      restaurant_name: order.restaurant_name || 'Store Partner',
      restaurant_address: order.restaurant_address || 'Store Location',
      delivery_address: order.delivery_address || 'Customer Delivery Address',
      user_name: order.user_name || 'Customer',
      estimated_distance: String(order.estimated_distance || '2.5'),
      payout_amount: String(order.payout_amount || '45.00'),
      commission_type: order.commission_type || 'fixed',
      status: order.status || 'PENDING',
      ...order,
    };
    setOrderData(fullOrder);
    setVisible(true);
    OrderAlarm.wakeScreen();
  };

  const hideOrderAlert = () => {
    setVisible(false);
    setOrderData(null);
    OrderAlarm.stopAlarm();
  };

  const handleProcessIncomingPayload = async (
    data: any,
    title?: string,
    body?: string,
    identifier?: string
  ) => {
    const dedupeKey = identifier || `${data?.job_id || data?.order_id || 'unknown'}:${data?.status || 'pending'}`;
    const now = Date.now();
    const lastSeen = recentNotificationTimestamps.get(dedupeKey);
    // Ignore duplicate events fired within 3 seconds
    if (lastSeen && now - lastSeen < 3000) {
      return;
    }
    recentNotificationTimestamps.set(dedupeKey, now);

    const parsedOrder = parseOrderFromPayload(data, title, body);
    if (!parsedOrder) return;

    // Save to history storage
    await saveNotification({
      id: identifier || String(Date.now()),
      type: 'order',
      title: title || 'New Order Request',
      body: body || 'Tap to view and accept delivery job',
      time: 'Just now',
      orderData: parsedOrder,
    });

    showOrderAlert(parsedOrder);

    // If partner is logged in, optionally fetch rich details from backend
    if (partner?.id && parsedOrder.job_id && parsedOrder.job_id !== 9999) {
      try {
        const res = await fetch(CONFIG.ENDPOINTS.GET_DELIVERY_JOBS, {
          method: 'POST',
          headers: CONFIG.HEADERS,
          body: JSON.stringify({ partner_id: partner.id }),
        });
        const jobsData = await res.json();
        if (jobsData.success && Array.isArray(jobsData.jobs)) {
          const match = jobsData.jobs.find(
            (j: any) => String(j.id) === String(parsedOrder.job_id) || String(j.job_id) === String(parsedOrder.job_id)
          );
          if (match) {
            setOrderData((prev) => (prev ? { ...prev, ...match, job_id: match.id || prev.job_id } : prev));
          }
        }
      } catch (e) {
        console.warn('[OrderAlertContext] Backend order detail sync error:', e);
      }
    }
  };

  // 1. Subscribe to push notification listeners
  useEffect(() => {
    if (isExpoGo || !Notifications) return;

    // A. Foreground notification listener
    const receivedSub = Notifications.addNotificationReceivedListener(async (notif) => {
      const title = notif.request.content?.title || 'New Order Alert';
      const body = notif.request.content?.body || 'New delivery order received!';
      const data = notif.request.content?.data || {};
      await handleProcessIncomingPayload(data, title, body, notif.request.identifier);
    });

    // B. Background notification tap listener
    const responseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const title = response.notification.request.content?.title || 'New Order Alert';
      const body = response.notification.request.content?.body || 'New delivery order received!';
      const data = response.notification.request.content?.data || {};
      await handleProcessIncomingPayload(data, title, body, response.notification.request.identifier);
    });

    // C. Cold-start check
    Notifications.getLastNotificationResponseAsync().then(async (lastResponse) => {
      if (lastResponse) {
        const title = lastResponse.notification.request.content?.title || 'New Order Alert';
        const body = lastResponse.notification.request.content?.body || 'New delivery order received!';
        const data = lastResponse.notification.request.content?.data || {};
        await handleProcessIncomingPayload(data, title, body, lastResponse.notification.request.identifier);
        await Notifications?.clearLastNotificationResponseAsync();
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [partner?.id]);

  // 2. Check Android Native Intent Extras (Lockscreen wakeup / Fullscreen intent)
  const checkNativeIntent = async () => {
    if (Platform.OS !== 'android') return;
    try {
      const nativeAlert = await OrderAlarm.getInitialOrderAlert();
      if (nativeAlert && Object.keys(nativeAlert).length > 0) {
        await handleProcessIncomingPayload(
          nativeAlert,
          nativeAlert.title || 'New Order Request',
          nativeAlert.body || 'Tap to accept delivery job',
          `native-${Date.now()}`
        );
      }
    } catch (e) {
      console.warn('[OrderAlertContext] checkNativeIntent error:', e);
    }
  };

  useEffect(() => {
    checkNativeIntent();

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkNativeIntent();
      }
    });

    return () => {
      appStateSub.remove();
    };
  }, []);

  const handleAccept = async (jobId: number) => {
    hideOrderAlert();

    if (jobId === 9999) {
      Alert.alert('Demo Order Accepted', 'Demo order accepted successfully!');
      return;
    }

    if (!partner?.id) {
      Alert.alert('Login Required', 'Please log in to accept delivery jobs.');
      return;
    }

    try {
      const response = await fetch(CONFIG.ENDPOINTS.ACCEPT_DELIVERY_JOB, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({
          partner_id: partner.id,
          job_id: jobId,
        }),
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Order accepted successfully! Navigating to job details...');
        router.replace('/home');
      } else {
        Alert.alert('Notice', data.message || 'Job could not be accepted.');
      }
    } catch (error) {
      console.error('[OrderAlertContext] Error accepting job:', error);
      Alert.alert('Network Error', 'Could not reach server to accept order. Please check your connection.');
    }
  };

  const handleDecline = (jobId: number) => {
    hideOrderAlert();
  };

  return (
    <OrderAlertContext.Provider
      value={{
        showOrderAlert,
        hideOrderAlert,
        isAlertVisible: visible,
        currentOrder: orderData,
      }}
    >
      {children}
      <NewOrderModal
        visible={visible}
        order={orderData}
        onClose={hideOrderAlert}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </OrderAlertContext.Provider>
  );
}

export function useOrderAlert() {
  const context = useContext(OrderAlertContext);
  if (!context) {
    throw new Error('useOrderAlert must be used within an OrderAlertProvider');
  }
  return context;
}

