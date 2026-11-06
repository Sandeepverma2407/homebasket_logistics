import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  ScrollView,
  TextInput,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { CustomAlert as Alert } from '../components/CustomAlert';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import CustomButton from '@/components/CustomButton';
import CustomInput from '@/components/CustomInput';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import CONFIG from '../connection/config';
import SwipeButton from '../components/SwipeButton';

export default function CompleteScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  // PIN entry state (4 digits)
  const [pin, setPin] = useState(['', '', '', '']);
  const [codCollected, setCodCollected] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [rating, setRating] = useState(0);

  const [jobDetails, setJobDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [otpError, setOtpError] = useState('');

  const { partner } = useAuth();
  const params = useLocalSearchParams();

  React.useEffect(() => {
    const fetchJobDetails = async () => {
      if (!params.jobId || !partner?.id) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(CONFIG.ENDPOINTS.GET_DELIVERY_JOBS, {
          method: 'POST',
          headers: CONFIG.HEADERS,
          body: JSON.stringify({ partner_id: partner.id })
        });
        const data = await response.json();
        console.log('[CompleteScreen] Fetch jobs response success:', data.success);
        if (data.success && data.jobs) {
          const targetJob = data.jobs.find((j: any) => 
            (params.jobId && String(j.id) === String(params.jobId)) ||
            (params.orderId && String(j.custom_order_id) === String(params.orderId)) ||
            (params.orderId && String(j.order_id) === String(params.orderId))
          );
          if (targetJob) {
            console.log('[CompleteScreen] Found job details:', targetJob.id);
            setJobDetails(targetJob);
          }
        }
      } catch (error) {
        console.error('[CompleteScreen] Error fetching job details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchJobDetails();
  }, [params.jobId, partner?.id]);

  const pinRefs = React.useRef<(TextInput | null)[]>([]);

  const handlePinChange = (val: string, index: number) => {
    const digit = val.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...pin];
    updated[index] = digit;
    setPin(updated);
    setOtpError('');
    if (digit && index < 3) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (pin[index] === '' && index > 0) {
        const updated = [...pin];
        updated[index - 1] = '';
        setPin(updated);
        pinRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleSwipeMarkDelivered = async () => {
    const enteredOtp = pin.join('').trim();
    setOtpError('');
    const isCod = jobDetails?.payment_method === 'COD';
    if (isCod && !codCollected) {
      setOtpError('Payment Required: Please confirm cash collection by checking the box.');
      return;
    }

    if (params.jobId && partner?.id) {
      try {
        const response = await fetch(CONFIG.ENDPOINTS.UPDATE_JOB_STATUS, {
          method: 'POST',
          headers: CONFIG.HEADERS,
          body: JSON.stringify({
            partner_id: partner.id,
            job_id: parseInt(params.jobId as string, 10),
            status: 'DELIVERED',
            otp_code: enteredOtp,
          })
        });
        const data = await response.json();
        if (!data.success) {
          setOtpError(data.message || 'Failed to verify delivery OTP.');
          setPin(['', '', '', '']);
          pinRefs.current[0]?.focus();
          return;
        }
      } catch (error) {
        console.error('Error updating status to DELIVERED:', error);
        Alert.alert('Error', 'Connection failed. Please try again.');
        return;
      }
    }
    setDelivered(true);
  };

  const isCod = jobDetails?.payment_method === 'COD';
  const enteredOtpVal = pin.join('').trim();
  const isOtpComplete = enteredOtpVal.length === 4;
  const canMarkDelivered = isOtpComplete && (!isCod || codCollected);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Extract phone number and clean address
  const phoneRegex = /(?:Contact(?:\s*No)?|Phone|Mobile|Mob|Tel|Ph)[:\s-]*(\+?\d[\d\s-]{8,14}\d)/i;
  const phoneMatch = (jobDetails?.delivery_address || '').match(phoneRegex);
  const rawCustomerPhone = (phoneMatch ? phoneMatch[1] : '') || jobDetails?.user_phone || jobDetails?.phone || '';
  const phoneNumber = rawCustomerPhone ? rawCustomerPhone.replace(/[-\s]/g, '') : '';

  const cleanDeliveryAddress = (jobDetails?.delivery_address || 'Block B, Apartment 302, Green Valley')
    .replace(/(?:Contact|Phone|Mobile|Tel)[:\s-]*\+?\d[\d\s-]{8,14}\d/gi, '')
    .trim()
    .replace(/,\s*$/, '');

  const userName = jobDetails?.user_name || 'Sarah J.';
  const userInitials = (() => {
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  })();

  const toPayAmount = jobDetails?.to_pay || '0.00';

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.iconBg }]}
          hitSlop={12}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19 12H5M12 19l-7-7 7-7"
              stroke={colors.textPrimary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.accent }]}>Complete Delivery</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* ── DELIVERED SUCCESS VIEW ── */}
      {delivered ? (
        <ScrollView contentContainerStyle={styles.successScroll} showsVerticalScrollIndicator={false}>
          {/* Big success icon */}
          <View style={[styles.successIconWrapper, { backgroundColor: colors.accentLight }]}>
            <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" fill={colors.accent} />
              <Path
                d="M8 12l3 3 5-5"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Delivery Successful!</Text>
          <Text style={[styles.successSub, { color: colors.textSecondary }]}>
            Great job. You earned ₹{parseFloat(jobDetails?.payout_amount || '45').toFixed(2)} for this trip.
          </Text>

          {/* Earnings summary pill */}
          <View style={[styles.earningsPill, { backgroundColor: colors.accentLight }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
                stroke={colors.accent}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </Svg>
            <Text style={[styles.earningsPillText, { color: colors.accent }]}>₹{parseFloat(jobDetails?.payout_amount || '45').toFixed(2)} Added to Wallet</Text>
          </View>

          {/* Rating */}
          <Text style={[styles.rateLabel, { color: colors.textSecondary }]}>RATE DROP-OFF EXPERIENCE</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)} hitSlop={6}>
                <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    fill={star <= rating ? '#f59e0b' : 'none'}
                    stroke={star <= rating ? '#f59e0b' : colors.border}
                    strokeWidth="1.5"
                  />
                </Svg>
              </Pressable>
            ))}
          </View>

          <CustomButton
            title="Back to Dashboard"
            variant="primary"
            onPress={() => router.replace('/home')}
            style={styles.dashBtn}
          />
        </ScrollView>
      ) : (
        // ── VERIFICATION FORM ──
        <ScrollView
          contentContainerStyle={styles.formScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Customer card */}
          <View style={[styles.customerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.customerAvatar, { backgroundColor: colors.accent }]}>
              <Text style={styles.avatarText}>{userInitials}</Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={[styles.customerName, { color: colors.textPrimary }]}>{userName}</Text>
              <View style={styles.addressRow}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Circle cx="12" cy="10" r="3" stroke={colors.textSecondary} strokeWidth="2" />
                  <Path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" stroke={colors.textSecondary} strokeWidth="2" />
                </Svg>
                <Text style={[styles.customerAddress, { color: colors.textSecondary }]}>
                  {cleanDeliveryAddress}
                </Text>
              </View>
            </View>
            <Pressable 
              onPress={() => {
                if (phoneNumber) {
                  Linking.openURL('tel:' + phoneNumber);
                } else {
                  Alert.alert('Phone Number Not Available', 'Customer contact number is not provided for this order.');
                }
              }}
              style={[styles.callBtn, { backgroundColor: isDarkMode ? '#1e2433' : '#eef4ff' }]}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
                  stroke="#4f80e0"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          </View>

          {/* ── VERIFICATION section ── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>VERIFICATION</Text>
          <View style={[styles.verificationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.verificationHint, { color: colors.textSecondary }]}>
              Ask the customer for the 4-digit delivery PIN. They can see it in their HB Logistics app under Order Details / Track Order.
            </Text>

            {/* OTP / PIN boxes */}
            <View style={styles.pinRow}>
              {pin.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { pinRefs.current[i] = r; }}
                  value={digit}
                  onChangeText={(v) => handlePinChange(v, i)}
                  onKeyPress={(e) => handleKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  style={[
                    styles.pinBox,
                    {
                      color: colors.textPrimary,
                      borderColor: digit ? colors.accent : colors.border,
                      backgroundColor: colors.inputBg || colors.iconBg,
                    },
                  ]}
                  textAlign="center"
                />
              ))}
            </View>



            {/* Divider OR */}
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.textSecondary }]}>OR</Text>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Scan QR Code button */}
            <CustomButton
              title="Scan QR Code"
              variant="primary"
              onPress={() => {}}
              style={[styles.scanBtn, { backgroundColor: isDarkMode ? '#1e2433' : '#eef4ff', shadowOpacity: 0, elevation: 0 }]}
              textStyle={{ color: '#4f80e0', fontSize: 15 }}
              leftIcon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Rect x="3" y="3" width="7" height="7" rx="1" stroke="#4f80e0" strokeWidth="2" />
                  <Rect x="14" y="3" width="7" height="7" rx="1" stroke="#4f80e0" strokeWidth="2" />
                  <Rect x="3" y="14" width="7" height="7" rx="1" stroke="#4f80e0" strokeWidth="2" />
                  <Path d="M14 14h3v3M17 17v3h3" stroke="#4f80e0" strokeWidth="2" strokeLinecap="round" />
                </Svg>
              }
            />
          </View>

          {/* ── PAYMENT COLLECTION ── */}
          {isCod && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PAYMENT COLLECTION</Text>
              <Pressable
                onPress={() => {
                  setCodCollected(!codCollected);
                  setOtpError('');
                }}
                style={[
                  styles.codCard,
                  {
                    backgroundColor: codCollected ? colors.accentLight : colors.card,
                    borderColor: codCollected ? colors.accent : colors.border,
                  },
                ]}
              >
                <View style={[styles.codIconBg, { backgroundColor: colors.accent }]}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Rect x="2" y="5" width="20" height="14" rx="2" stroke="#fff" strokeWidth="2" />
                    <Path d="M2 10h20" stroke="#fff" strokeWidth="2" />
                  </Svg>
                </View>
                <View style={styles.codInfo}>
                  <Text style={[styles.codLabel, { color: colors.accent }]}>CASH ON DELIVERY</Text>
                  <Text style={[styles.codAmount, { color: colors.textPrimary }]}>₹{toPayAmount}</Text>
                </View>
                {/* Checkbox */}
                <View style={[
                  styles.checkbox,
                  {
                    borderColor: codCollected ? colors.accent : colors.border,
                    backgroundColor: codCollected ? colors.accent : 'transparent',
                  },
                ]}>
                  {codCollected && (
                    <Svg width={12} height={10} viewBox="0 0 12 10" fill="none">
                      <Path d="M1 5l3.5 3.5L11 1" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  )}
                </View>
              </Pressable>
            </>
          )}

          {/* Mark as Delivered */}
          <SwipeButton
            text="Swipe to Mark as Delivered"
            color={canMarkDelivered ? "#10b981" : "#94a3b8"}
            disabled={!canMarkDelivered}
            onSwipeSuccess={handleSwipeMarkDelivered}
            containerStyle={styles.deliverSwipeBtn}
          />

          {otpError ? (
            <Text style={styles.errorTextMsgBelow}>{otpError}</Text>
          ) : null}

          <View style={{ height: Math.max(insets.bottom, 24) + 16 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: 17 },
  headerPlaceholder: { width: 36 },

  // Form
  formScroll: { paddingHorizontal: 20, paddingTop: 20 },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#fff' },
  customerInfo: { flex: 1 },
  customerName: { fontFamily: 'Inter-Bold', fontSize: 16, marginBottom: 6 },
  addressRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  customerAddress: { fontFamily: 'Inter-Regular', fontSize: 13, flex: 1 },
  callBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  verificationCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  verificationHint: { fontFamily: 'Inter-Regular', fontSize: 13, marginBottom: 18 },

  pinRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  pinBox: {
    width: 58,
    height: 60,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 26,
    fontFamily: 'Inter-Bold',
  },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, width: '100%' },
  orLine: { flex: 1, height: 1 },
  orText: { fontFamily: 'Inter-SemiBold', fontSize: 13 },

  scanBtn: { width: '100%', height: 48, borderRadius: 12 },

  codCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  codIconBg: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  codInfo: { flex: 1 },
  codLabel: { fontFamily: 'Inter-Bold', fontSize: 11, letterSpacing: 0.7, marginBottom: 4 },
  codAmount: { fontFamily: 'Inter-Bold', fontSize: 22 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  deliverSwipeBtn: {
    width: '100%',
    marginTop: 12,
  },

  // Success screen
  successScroll: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 48, paddingBottom: 40 },
  successIconWrapper: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  successTitle: { fontFamily: 'Inter-Bold', fontSize: 26, textAlign: 'center', marginBottom: 10 },
  successSub: { fontFamily: 'Inter-Regular', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  earningsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    marginBottom: 36,
  },
  earningsPillText: { fontFamily: 'Inter-Bold', fontSize: 16 },
  rateLabel: { fontFamily: 'Inter-Bold', fontSize: 11, letterSpacing: 0.8, marginBottom: 16 },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 40 },
  dashBtn: { width: '100%', height: 54, borderRadius: 14 },
  errorTextMsg: {
    color: '#ef4444',
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorTextMsgBelow: {
    color: '#ef4444',
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
});
