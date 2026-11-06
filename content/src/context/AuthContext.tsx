import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerAndSyncFcmToken } from '../services/fcmService';
import CONFIG from '../connection/config';
import OrderAlarm from '../services/orderAlarmNative';

export interface Partner {
  id: number;
  DP_ID: string | null;
  name: string;
  mobile_no: string;
  email: string | null;
  email_address?: string | null;
  partner_type?: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  city: string | null;
  address: string | null;
  profile_photo: string | null;
  approve_status: 'pending' | 'approved' | 'rejected' | null;
  status: 'active' | 'blocked' | null;
  is_online?: number;
  last_login?: string | null;
  current_lat?: string | null;
  current_lng?: string | null;
  working_status?: 'AVAILABLE' | 'ON_DELIVERY';
  commission_type: 'fixed' | 'distance';
  commission_rate: string;
  min_commission_amount: string;
  total_earnings?: string;
  cash_in_hand?: string;
  Fcm_Id: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  partner: Partner | null;
  isLoading: boolean;
  login: (partnerData: Partner) => Promise<void>;
  logout: () => Promise<void>;
  updatePartnerState: (partnerData: Partial<Partner>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Always holds the latest session. Async work (profile refreshes, FCM sync) that finishes after
  // a logout must not bring the old session back, so it checks this ref instead of a stale closure.
  const partnerRef = useRef<Partner | null>(null);
  const applyPartner = useCallback((next: Partner | null) => {
    partnerRef.current = next;
    setPartner(next);
  }, []);

  useEffect(() => {
    // Load partner from storage on startup
    const loadStorageData = async () => {
      try {
        const storedPartner = await AsyncStorage.getItem('@partner_session');
        if (storedPartner) {
          const parsedPartner: Partner = JSON.parse(storedPartner);
          applyPartner(parsedPartner);
          // Sync FCM token on app launch for active session
          if (parsedPartner && parsedPartner.id) {
            registerAndSyncFcmToken(parsedPartner.id).then((fcmToken) => {
              const current = partnerRef.current;
              if (fcmToken && current && current.id === parsedPartner.id) {
                applyPartner({ ...current, Fcm_Id: fcmToken });
              }
            });
          }
        }
      } catch (e) {
        console.log('Failed to load partner session from AsyncStorage:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStorageData();
  }, []);

  const login = async (partnerData: Partner) => {
    // Set state immediately to let the user log in
    applyPartner(partnerData);
    try {
      await AsyncStorage.setItem('@partner_session', JSON.stringify(partnerData));
    } catch (e) {
      console.log('Failed to save partner session to AsyncStorage:', e);
    }

    // Trigger FCM Token initialization, prompt permissions, and sync to database 'Delivery_Partners' table (Fcm_Id column)
    if (partnerData && partnerData.id) {
      const token = await registerAndSyncFcmToken(partnerData.id);
      // The user may have logged out while the token was being generated
      const current = partnerRef.current;
      if (token && current && current.id === partnerData.id) {
        const updatedPartner = { ...current, Fcm_Id: token };
        applyPartner(updatedPartner);
        try {
          await AsyncStorage.setItem('@partner_session', JSON.stringify(updatedPartner));
        } catch (e) {
          console.log('Failed to save updated partner session with Fcm_Id:', e);
        }
      }
    }
  };

  const logout = useCallback(async () => {
    const partnerId = partnerRef.current?.id;

    // End the session first. Any profile refresh still in flight sees no session and is ignored,
    // so it can no longer write the old partner back into state / storage.
    applyPartner(null);
    try {
      await AsyncStorage.multiRemove(['@partner_session', '@fcm_token']);
    } catch (e) {
      console.log('Failed to clear partner session from AsyncStorage:', e);
    }

    try {
      await OrderAlarm.stopAlarm();
    } catch (e) {}

    // Tell the backend (sets the partner Off_duty). Failure here must not keep the user logged in.
    try {
      if (partnerId) {
        await fetch(CONFIG.ENDPOINTS.LOGOUT, {
          method: 'POST',
          headers: CONFIG.HEADERS,
          body: JSON.stringify({ partner_id: partnerId }),
        }).catch((err) => {
          console.warn('Backend logout request warning:', err);
        });
      }
    } catch (e) {
      console.log('Error notifying backend during logout:', e);
    }
  }, [applyPartner]);

  // Stable identity (screens use it in effect dependency lists) and safe after logout
  const updatePartnerState = useCallback(async (updatedFields: Partial<Partner>) => {
    const current = partnerRef.current;
    if (!current) return; // logged out: ignore late results
    const updatedPartner = { ...current, ...updatedFields };
    applyPartner(updatedPartner);
    try {
      await AsyncStorage.setItem('@partner_session', JSON.stringify(updatedPartner));
    } catch (e) {
      console.log('Failed to update partner session in AsyncStorage:', e);
    }
  }, [applyPartner]);

  const value = useMemo(
    () => ({ partner, isLoading, login, logout, updatePartnerState }),
    // login only uses refs / stable callbacks, so it does not need to be a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partner, isLoading, logout, updatePartnerState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
