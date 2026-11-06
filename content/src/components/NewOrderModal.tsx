import React, { useEffect, useState, useRef } from 'react';
import { Modal, StyleSheet, View, Text, Pressable, Animated, Dimensions, ScrollView } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { BASE64_ALARM_SOUNDS } from '../constants/AlarmSoundsBase64';
import SwipeButton from './SwipeButton';
import OrderAlarm from '../services/orderAlarmNative';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NewOrderModalProps {
  visible: boolean;
  order: any;
  onClose: () => void;
  onAccept: (jobId: number) => void;
  onDecline: (jobId: number) => void;
}

export default function NewOrderModal({
  visible,
  order,
  onClose,
  onAccept,
  onDecline,
}: NewOrderModalProps) {
  const { colors } = useTheme();
  const [activeSoundName, setActiveSoundName] = useState<string>('Classic Bell');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const timerRef = useRef<any>(null);

  // Load user's saved sound preference, wake screen and trigger native alarm
  useEffect(() => {
    if (visible && order) {
      setTimeLeft(60);
      loadSavedSound().then((sound) => {
        OrderAlarm.wakeScreen();
        OrderAlarm.startAlarm(sound);
        setIsPlayingAudio(true);
      });

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            handleDecline();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      stopAudio();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopAudio();
    };
  }, [visible, order]);

  const loadSavedSound = async (): Promise<string> => {
    try {
      const saved = await AsyncStorage.getItem('order_alert_sound');
      const sound = saved && BASE64_ALARM_SOUNDS[saved] ? saved : 'Classic Bell';
      setActiveSoundName(sound);
      return sound;
    } catch (e) {
      console.warn('Error loading alarm sound preference:', e);
      setActiveSoundName('Classic Bell');
      return 'Classic Bell';
    }
  };

  const stopAudio = () => {
    setIsPlayingAudio(false);
    OrderAlarm.stopAlarm();
  };

  const handleAccept = () => {
    stopAudio();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (order) {
      const idToAccept = order.job_id || order.id || order.db_order_id;
      onAccept(idToAccept);
    }
  };

  const handleDecline = () => {
    stopAudio();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (order) {
      const idToDecline = order.job_id || order.id || order.db_order_id;
      onDecline(idToDecline);
    } else {
      onClose();
    }
  };

  if (!visible || !order) return null;

  // Calculate estimated earning dynamically
  const distance = parseFloat(String(order.estimated_distance || '2.5')).toFixed(1);
  const minCommission = parseFloat(String(order.min_commission_amount || '30.00'));
  const rate = parseFloat(String(order.commission_rate || '15.00'));
  const commissionType = String(order.commission_type || '').trim().toLowerCase();
  const backendEarning = parseFloat(String(order.payout_amount || order.amount || '0'));
  let calculatedEarning = backendEarning;
  if (!calculatedEarning) {
    calculatedEarning = commissionType === 'fixed'
      ? rate
      : Math.max(rate * parseFloat(distance), minCommission);
  }

  const formattedEarning = calculatedEarning.toFixed(2);
  const storeName = order.restaurant_name || order.store || 'Store Partner';
  const pickupAddress = order.restaurant_address || order.pickup_address || 'Store Location';
  const deliveryAddress = order.delivery_address || order.dropoff_address || 'Customer Delivery Address';
  const rawOrderId = String(order.custom_order_id || order.job_no || order.id || 'NEW');
  const customOrderId = rawOrderId.startsWith('#') ? rawOrderId : `#FD-${rawOrderId}`;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleDecline}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: '#00C896' }]}>
          
          {/* Header Banner */}
          <View style={styles.headerBanner}>
            <View style={styles.livePulseDot} />
            <Text style={styles.headerBannerText}>NEW ORDER REQUEST</Text>
            <Text style={styles.orderIdBadge}>{customOrderId}</Text>
          </View>

          {/* 60s Countdown Timer */}
          <View style={styles.timerContainer}>
            <View style={styles.timerRow}>
              <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>Respond within:</Text>
              <Text style={[styles.timerCountdown, { color: timeLeft <= 15 ? '#EF4444' : '#00C896' }]}>
                {timeLeft}s
              </Text>
            </View>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.max(0, Math.min(100, (timeLeft / 60) * 100))}%`,
                    backgroundColor: timeLeft <= 15 ? '#EF4444' : '#00C896',
                  },
                ]}
              />
            </View>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Earning & Distance Highlight Card */}
            <View style={styles.earningContainer}>
              <Text style={styles.earningLabelText}>ESTIMATED EARNING</Text>
              <Text style={styles.earningValueText}>₹ {formattedEarning}</Text>

              <View style={styles.distanceBadge}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" fill="#00C896" />
                </Svg>
                <Text style={styles.distanceBadgeText}>
                  {commissionType === 'fixed' ? 'Fixed payout per order' : `${distance} km distance`}
                </Text>
              </View>
            </View>

            {/* Pickup Store Section */}
            <View style={styles.locationSection}>
              <View style={styles.locationHeaderRow}>
                <View style={[styles.iconCircle, { backgroundColor: '#E6F4EA' }]}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm7 17H5V8h14v12z" fill="#00C896" />
                  </Svg>
                </View>
                <View style={styles.locationTitleContainer}>
                  <Text style={styles.locationTypeLabel}>PICKUP FROM STORE</Text>
                  <Text style={[styles.storeNameText, { color: colors.textPrimary }]}>{storeName}</Text>
                </View>
              </View>
              <Text style={[styles.addressDetailText, { color: colors.textSecondary }]}>{pickupAddress}</Text>
            </View>

            {/* Connecting Dotted Line */}
            <View style={styles.dottedConnectorContainer}>
              <View style={styles.dottedConnectorLine} />
            </View>

            {/* Dropoff Customer Section */}
            <View style={styles.locationSection}>
              <View style={styles.locationHeaderRow}>
                <View style={[styles.iconCircle, { backgroundColor: '#FCE8E6' }]}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" fill="#EA4335" />
                  </Svg>
                </View>
                <View style={styles.locationTitleContainer}>
                  <Text style={styles.locationTypeLabel}>DELIVER TO CUSTOMER</Text>
                  <Text style={[styles.storeNameText, { color: colors.textPrimary }]}>{order.user_name || 'Customer'}</Text>
                </View>
              </View>
              <Text style={[styles.addressDetailText, { color: colors.textSecondary }]}>{deliveryAddress}</Text>
            </View>
          </ScrollView>

          {/* Action Swipe Buttons */}
          <View style={styles.actionButtonsContainer}>
            <SwipeButton
              text="Swipe Right to Accept 🚀"
              color="#00C896"
              direction="right"
              onSwipeSuccess={handleAccept}
              containerStyle={{ marginBottom: 10 }}
            />
            <SwipeButton
              text="Swipe Left to Decline ❌"
              color="#EF4444"
              direction="left"
              onSwipeSuccess={handleDecline}
            />
          </View>

        </View>

        {/* Hidden WebView for Alarm Audio Playback */}
        {isPlayingAudio && activeSoundName && (
          <View style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}>
            <WebView
              originWhitelist={['*']}
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              source={{
                html: `
                  <!DOCTYPE html>
                  <html>
                  <head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
                  <body>
                    <audio id="alert_player" autoplay loop src="${BASE64_ALARM_SOUNDS[activeSoundName] || BASE64_ALARM_SOUNDS['Classic Bell']}"></audio>
                    <script>
                      const player = document.getElementById('alert_player');
                      player.play().catch(err => console.log("Autoplay blocked:", err));
                    </script>
                  </body>
                  </html>
                `
              }}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 24,
    borderWidth: 2,
    padding: 20,
    shadowColor: '#00C896',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#00C896',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  timerContainer: {
    marginBottom: 14,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timerLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  timerCountdown: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
  },
  progressBarBackground: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  livePulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    marginRight: 6,
  },
  headerBannerText: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: 0.8,
    flex: 1,
  },
  orderIdBadge: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    color: '#00C896',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scrollContent: {
    marginBottom: 16,
  },
  earningContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 18,
  },
  earningLabelText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: '#94A3B8',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  earningValueText: {
    fontFamily: 'Inter-Bold',
    fontSize: 32,
    color: '#00C896',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 200, 150, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#00C896',
    marginLeft: 6,
  },
  locationSection: {
    paddingVertical: 4,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  locationTitleContainer: {
    flex: 1,
  },
  locationTypeLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  storeNameText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginTop: 1,
  },
  addressDetailText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 44,
  },
  dottedConnectorContainer: {
    paddingLeft: 16,
    height: 20,
    justifyContent: 'center',
  },
  dottedConnectorLine: {
    width: 2,
    height: '100%',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  actionButtonsContainer: {
    width: '100%',
  },
});
