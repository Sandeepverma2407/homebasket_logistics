import React, { useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Image, Platform, ActivityIndicator, Linking, Animated } from 'react-native';
import { CustomAlert as Alert } from '../components/CustomAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import CustomButton from '@/components/CustomButton';
import { useTheme } from '../context/ThemeContext';
import BottomTabBar, { TabType } from '../components/BottomTabBar';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

import { useAuth } from '../context/AuthContext';
import CONFIG from '../connection/config';

const mapPreviewImg = require('../../assets/images/map-preview.png');

export default function OrderDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDarkMode } = useTheme();
  const { partner } = useAuth();

  const [jobDetails, setJobDetails] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [isPickedUp, setIsPickedUp] = React.useState(false);
  const [partnerLat, setPartnerLat] = React.useState<number | null>(null);
  const [partnerLng, setPartnerLng] = React.useState<number | null>(null);
  const webViewRef = useRef<WebView>(null);
  const [mapScrollEnabled, setMapScrollEnabled] = React.useState(true);
  const [mapLoaded, setMapLoaded] = React.useState(false);
  const insets = useSafeAreaInsets();

  const orderId = (params.orderId as string) || '#FD-8921';

  // Extract customer phone number: Priority 1: address contact info, Priority 2: backend user_phone, Priority 3: route params
  const phoneRegex = /(?:Contact(?:\s*No)?|Phone|Mobile|Mob|Tel|Ph)[:\s-]*(\+?\d[\d\s-]{8,14}\d)/i;
  const addressText = jobDetails?.delivery_address || (params.deliveryAddress as string) || '';
  const phoneMatch = addressText.match(phoneRegex);
  const rawCustomerPhone = (phoneMatch ? phoneMatch[1] : '') || jobDetails?.user_phone || jobDetails?.phone || (params.userPhone as string) || '';
  const phoneNumber = rawCustomerPhone ? rawCustomerPhone.replace(/[-\s]/g, '') : '';

  const cleanDeliveryAddress = (addressText || 'Block B, Apartment 302, Green Valley')
    .replace(/(?:Contact(?:\s*No)?|Phone|Mobile|Mob|Tel|Ph)[:\s-]*\+?\d[\d\s-]{8,14}\d/gi, '')
    .trim()
    .replace(/,\s*$/, ''); // remove trailing comma

  // Helper to split address into line1 (house/landmark) and line2 (other details)
  const getSplitAddress = (address: string) => {
    const parts = address.split(/[\r\n,]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return { line1: '', line2: '' };
    if (parts.length === 1) return { line1: parts[0], line2: '' };
    if (parts.length === 2) return { line1: parts[0], line2: parts[1] };
    if (parts.length === 3) return { line1: parts[0] + ', ' + parts[1], line2: parts[2] };

    const landmarkKeywords = ['near', 'opposite', 'behind', 'beside', 'next to', 'landmark', 'opp', 'front of'];
    let landmarkIndex = -1;
    for (let i = 0; i < parts.length; i++) {
      const partLower = parts[i].toLowerCase();
      if (landmarkKeywords.some(kw => partLower.includes(kw))) {
        landmarkIndex = i;
        break;
      }
    }

    if (landmarkIndex !== -1) {
      const line1 = parts.slice(0, landmarkIndex + 1).join(', ');
      const line2 = parts.slice(landmarkIndex + 1).join(', ');
      return { line1, line2 };
    } else {
      const line1 = parts.slice(0, 2).join(', ');
      const line2 = parts.slice(2).join(', ');
      return { line1, line2 };
    }
  };

  // Get initials for user avatar dynamically
  const userName = jobDetails?.user_name || 'Sarah J.';
  const userInitials = (() => {
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return userName.substring(0, 2).toUpperCase();
  })();

  const isOutForDeliveryStatus = (status?: string): boolean => {
    if (!status) return false;
    const s = String(status).trim().toUpperCase().replace(/\s+/g, '_');
    return ['PICKED_UP', 'OUT_FOR_DELIVERY', 'IN_TRANSIT', 'ARRIVED', 'ARRIVED_AT_CUSTOMER', 'DELIVERED'].includes(s);
  };

  React.useEffect(() => {
    const fetchJobDetails = async () => {
      if (!params.jobId) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(CONFIG.ENDPOINTS.GET_DELIVERY_JOBS, {
          method: 'POST',
          headers: CONFIG.HEADERS,
          body: JSON.stringify({ partner_id: partner?.id || 0 })
        });
        const data = await response.json();
        if (data.success && data.jobs) {
          const targetJob = data.jobs.find((j: any) =>
            (params.jobId && String(j.id) === String(params.jobId)) ||
            (params.orderId && String(j.custom_order_id) === String(params.orderId)) ||
            (params.orderId && String(j.order_id) === String(params.orderId))
          );
          if (targetJob) {
            setJobDetails(targetJob);
            if (isOutForDeliveryStatus(targetJob.status)) {
              setIsPickedUp(true);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching job details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchJobDetails();
  }, [params.jobId, partner?.id]);

  // Get partner's current GPS location
  React.useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      // Get initial position fast
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPartnerLat(initial.coords.latitude);
      setPartnerLng(initial.coords.longitude);
      // Watch for updates
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (loc) => {
          setPartnerLat(loc.coords.latitude);
          setPartnerLng(loc.coords.longitude);
          // Push updated partner position to the map
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'UPDATE_PARTNER',
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          }));
        }
      );
    })();
    return () => { subscription?.remove(); };
  }, []);

  const handleTabPress = (tab: TabType) => {
    if (tab === 'home') {
      router.back();
    } else if (tab === 'orders') {
      router.replace('/orders');
    } else if (tab === 'earnings') {
      router.replace('/earnings');
    } else if (tab === 'profile') {
      router.replace('/settings');
    }
  };

  if (loading) {
    return <OrderDetailsLoader colors={colors} insets={insets} />;
  }

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* TopAppBar Header */}
      <View style={[styles.headerBar, { backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={15}>
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <Path
              d="M3.825 9L9.425 14.6L8 16L0 8L8 0L9.425 1.4L3.825 7H16V9H3.825Z"
              fill={colors.accent}
            />
          </Svg>
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.accent }]}>Order Details</Text>
        </View>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={true}
        showsVerticalScrollIndicator={false}
        scrollEnabled={mapScrollEnabled}
      >
        {/* Header Section */}
        <View style={styles.orderHeaderSection}>
          <View style={styles.orderIdContainer}>
            <Text style={[styles.orderIdLabel, { color: colors.textSecondary }]}>ORDER ID</Text>
            <Text style={[styles.orderIdValue, { color: colors.textPrimary }]}>{jobDetails?.custom_order_id || orderId}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.accent }]}>
            <Svg width={12} height={9} viewBox="0 0 15 11" fill="none" style={styles.badgeCheckIcon}>
              <Path
                d="M1.33333 10.6667C0.966667 10.6667 0.652778 10.5361 0.391667 10.275C0.130556 10.0139 0 9.7 0 9.33333V1.33333C0 0.966667 0.130556 0.652778 0.391667 0.391667C0.652778 0.130556 0.966667 0 1.33333 0H13.3333C13.7 0 14.0139 0.130556 14.275 0.391667C14.5361 0.652778 14.6667 0.966667 14.6667 1.33333V9.33333C14.6667 9.7 14.5361 10.0139 14.275 10.275C14.0139 10.5361 13.7 10.6667 13.3333 10.6667H1.33333ZM1.66667 7.33333H2.5V5L4.2 7.33333H5V3.33333H4.16667V5.66667L2.5 3.33333H1.66667V7.33333ZM5.66667 7.33333H8.33333V6.5H6.66667V5.76667H8.33333V4.93333H6.66667V4.16667H8.33333V3.33333H5.66667V7.33333ZM9.66667 7.33333H12.3333C12.5222 7.33333 12.6806 7.26944 12.8083 7.14167C12.9361 7.01389 13 6.85556 13 6.66667V3.33333H12.1667V6.33333H11.4333V4H10.6V6.33333H9.83333V3.33333H9V6.66667C9 6.85556 9.06389 7.01389 9.19167 7.14167C9.31944 7.26944 9.47778 7.33333 9.66667 7.33333Z"
                fill="white"
              />
            </Svg>
            <Text style={styles.statusBadgeText}>{jobDetails?.status || 'NEW'}</Text>
          </View>
        </View>



        {/* Store Details Card */}
        <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.storeIconContainer, { backgroundColor: colors.iconBg }]}>
            <Svg width={18} height={16} viewBox="0 0 18 16" fill="none">
              <Path
                d="M1 2V0H17V2H1ZM1 16V10H0V8L1 3H17L18 8V10H17V16H15V10H11V16H1ZM3 14H9V10H3V14Z"
                fill={colors.accent}
              />
            </Svg>
          </View>
          <View style={styles.cardInfoContainer}>
            <Text style={[styles.cardTitleText, { color: colors.textPrimary }]}>{jobDetails?.restaurant_name || 'Fresh Supermarket'}</Text>
            <Text style={[styles.cardSubtitleText, { color: colors.textSecondary }]}>{jobDetails?.restaurant_address || 'Sector 14, Main Market'}</Text>
          </View>
        </View>

        {/* Customer Details Card */}
        <View style={[styles.detailsCard, styles.customerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.customerHeaderRow}>
            <View style={[styles.initialsAvatar, { backgroundColor: colors.accentLight }]}>
              <Text style={[styles.initialsText, { color: colors.accent }]}>{userInitials}</Text>
            </View>
            <View style={styles.cardInfoContainer}>
              <Text style={[styles.cardTitleText, { color: colors.textPrimary }]}>{userName}</Text>
              {phoneNumber ? (
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.accent, marginTop: 2 }}>
                  📞 {phoneNumber}
                </Text>
              ) : null}
              {(() => {
                const { line1, line2 } = getSplitAddress(cleanDeliveryAddress);
                return (
                  <View style={{ gap: 3, marginTop: 3 }}>
                    <Text style={[styles.cardSubtitleText, { color: colors.textSecondary }]}>
                      {line1}
                    </Text>
                    {line2 ? (
                      <Text style={[styles.cardSubtitleText, { color: colors.textSecondary }]}>
                        {line2}
                      </Text>
                    ) : null}
                  </View>
                );
              })()}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.customerActionsRow}>
            <Pressable 
              style={[styles.customerActionBtn, { backgroundColor: colors.iconBg }]} 
              onPress={() => {
                if (phoneNumber) {
                  Linking.openURL('tel:' + phoneNumber);
                } else {
                  Alert.alert('Phone Number Not Available', 'Customer contact number is not provided for this order.');
                }
              }}
            >
              <View style={styles.btnInnerContent}>
                <Svg width={14} height={14} viewBox="0 0 14 14" fill="none" style={styles.actionBtnIcon}>
                  <Path
                    d="M12.7125 13.5C11.15 13.5 9.60625 13.1594 8.08125 12.4781C6.55625 11.7969 5.16875 10.8313 3.91875 9.58125C2.66875 8.33125 1.70312 6.94375 1.02188 5.41875C0.340625 3.89375 0 2.35 0 0.7875C0 0.5625 0.075 0.375 0.225 0.225C0.375 0.075 0.5625 0 0.7875 0H3.825C4 0 4.15625 0.059375 4.29375 0.178125C4.43125 0.296875 4.5125 0.4375 4.5375 0.6L5.025 3.225C5.05 3.425 5.04375 3.59375 5.00625 3.73125C4.96875 3.86875 4.9 3.9875 4.8 4.0875L2.98125 5.925C3.23125 6.3875 3.52813 6.83437 3.87188 7.26562C4.21562 7.69688 4.59375 8.1125 5.00625 8.5125C5.39375 8.9 5.8 9.25937 6.225 9.59062C6.65 9.92188 7.1 10.225 7.575 10.5L9.3375 8.7375C9.45 8.625 9.59688 8.54062 9.77812 8.48438C9.95937 8.42813 10.1375 8.4125 10.3125 8.4375L12.9 8.9625C13.075 9.0125 13.2188 9.10312 13.3313 9.23438C13.4438 9.36563 13.5 9.5125 13.5 9.675V12.7125C13.5 12.9375 13.425 13.125 13.275 13.275C13.125 13.425 12.9375 13.5 12.7125 13.5ZM2.26875 4.5L3.50625 3.2625L3.1875 1.5H1.51875C1.58125 2.0125 1.66875 2.51875 1.78125 3.01875C1.89375 3.51875 2.05625 4.0125 2.26875 4.5ZM8.98125 11.2125C9.46875 11.425 9.96562 11.5938 10.4719 11.7188C10.9781 11.8438 11.4875 11.925 12 11.9625V10.3125L10.2375 9.95625L8.98125 11.2125Z"
                    fill={colors.textPrimary}
                  />
                </Svg>
                <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Call</Text>
              </View>
            </Pressable>

            <Pressable style={[styles.customerActionBtn, { backgroundColor: colors.iconBg, opacity: 0.5 }]} disabled={true} onPress={() => { }}>
              <View style={styles.btnInnerContent}>
                <Svg width={15} height={15} viewBox="0 0 15 15" fill="none" style={styles.actionBtnIcon}>
                  <Path
                    d="M3 9H9V7.5H3V9ZM3 6.75H12V5.25H3V6.75ZM3 4.5H12V3H3V4.5ZM0 15V1.5C0 1.0875 0.146875 0.734375 0.440625 0.440625C0.734375 0.146875 1.0875 0 1.5 0H13.5C13.9125 0 14.2656 0.146875 14.5594 0.440625C14.8531 0.734375 15 1.0875 15 1.5V10.5C15 10.9125 14.8531 11.2656 14.5594 11.5594C14.2656 11.8531 13.9125 12 13.5 12H3L0 15ZM2.3625 10.5H13.5V1.5H1.5V11.3438L2.3625 10.5ZM1.5 10.5V1.5V10.5Z"
                    fill={colors.textMuted}
                  />
                </Svg>
                <View style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>Chat</Text>
                  <Text style={{ fontFamily: 'Inter-Medium', fontSize: 7, color: '#f59e0b', marginTop: 1, letterSpacing: 0.2 }}>COMING SOON</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Delivery Meta Data Section */}
        <View style={styles.metaRow}>
          {/* Distance Box */}
          <View style={[styles.metaBox, { backgroundColor: colors.iconBg, borderColor: colors.border }]}>
            <Svg width={18} height={18} viewBox="0 0 18 18" fill="none" style={styles.metaIcon}>
              <Path
                d="M6 18C4.9 18 3.95833 17.6083 3.175 16.825C2.39167 16.0417 2 15.1 2 14V5.825C1.41667 5.60833 0.9375 5.24583 0.5625 4.7375C0.1875 4.22917 0 3.65 0 3C0 2.16667 0.291667 1.45833 0.875 0.875C1.45833 0.291667 2.16667 0 3 0C3.83333 0 4.54167 0.291667 5.125 0.875C5.70833 1.45833 6 2.16667 6 3C6 3.65 5.8125 4.22917 5.4375 4.7375C5.0625 5.24583 4.58333 5.60833 4 5.825V14C4 14.55 4.19583 15.0208 4.5875 15.4125C4.97917 15.8042 5.45 16 6 16C6.55 16 7.02083 15.8042 7.4125 15.4125C7.80417 15.0208 8 14.55 8 14V4C8 2.9 8.39167 1.95833 9.175 1.175C9.95833 0.391667 10.9 0 12 0C13.1 0 14.0417 0.391667 14.825 1.175C15.6083 1.95833 16 2.9 16 4V12.175C16.5833 12.3917 17.0625 12.7542 17.4375 13.2625C17.8125 13.7708 18 14.35 18 15C18 15.8333 17.7083 16.5417 17.125 17.125C16.5417 17.7083 15.8333 18 15 18C14.1667 18 13.4583 17.7083 12.875 17.125C12.2917 16.5417 12 15.8333 12 15C12 14.35 12.1875 13.7667 12.5625 13.25C12.9375 12.7333 13.4167 12.375 14 12.175V4C14 3.45 13.8042 2.97917 13.4125 2.5875C13.0208 2.19583 12.55 2 12 2C11.45 2 10.9792 2.19583 10.5875 2.5875C10.1958 2.97917 10 3.45 10 4V14C10 15.1 9.60833 16.0417 8.825 16.825C8.04167 17.6083 7.1 18 6 18ZM3 4C3.28333 4 3.52083 3.90417 3.7125 3.7125C3.90417 3.52083 4 3.28333 4 3C4 2.71667 3.90417 2.47917 3.7125 2.2875C3.52083 2.09583 3.28333 2 3 2C2.71667 2 2.47917 2.09583 2.2875 2.2875C2.09583 2.47917 2 2.71667 2 3C2 3.28333 2.09583 3.52083 2.2875 3.7125C2.47917 3.90417 2.71667 4 3 4ZM15 16C15.2833 16 15.5208 15.9042 15.7125 15.7125C15.9042 15.5208 16 15.2833 16 15C16 14.7167 15.9042 14.4792 15.7125 14.2875C15.5208 14.0958 15.2833 14 15 14C14.7167 14 14.4792 14.0958 14.2875 14.2875C14.0958 14.4792 14 14.7167 14 15C14 15.2833 14.0958 15.5208 14.2875 15.7125C14.4792 15.9042 14.7167 16 15 16Z"
                fill={colors.textSecondary}
              />
            </Svg>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Est. Distance</Text>
            <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{jobDetails?.estimated_distance ? jobDetails.estimated_distance + ' km' : '2.4 km'}</Text>
          </View>

          {/* Est Earnings Box */}
          <View style={[styles.metaBox, { backgroundColor: colors.iconBg, borderColor: colors.border }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={styles.metaIcon}>
              <Path
                d="M11 15.5H7.825L11.325 19H9.175L5.5 15.225V13.5H11C11.5333 13.5 11.9583 13.3292 12.275 12.9875C12.5917 12.6458 12.75 12.2333 12.75 11.75C12.75 11.25 12.5917 10.8292 12.275 10.4875C11.9583 10.1458 11.5333 9.975 11 9.975H5.5V8.25H10.5L5.5 5H7.675L13.5 8.725V9.975H12.5C12.9 10.3083 13.2042 10.7167 13.4125 11.2C13.6208 11.6833 13.725 12.2 13.725 12.75C13.725 13.6667 13.4083 14.4333 12.775 15.05C12.1417 15.6667 11.35 15.975 10.4 15.975H11V15.5ZM5.5 15.5V13.5H4V15.5H5.5ZM5.5 9.975V8.25H4V9.975H5.5Z"
                fill={colors.accent}
              />
              <Path
                d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2ZM4 12C4 7.582 7.582 4 12 4C16.418 4 20 7.582 20 12C20 16.418 16.418 20 12 20C7.582 20 4 16.418 4 12Z"
                fill={colors.accent}
              />
            </Svg>
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Est. Earnings</Text>
            <Text style={[styles.metaValue, styles.earningsValueText, { color: colors.accent }]}>₹{jobDetails?.payout_amount || '65.00'}</Text>
          </View>
        </View>

        {/* Customer Instructions Card */}
        <View style={[styles.instructionsCard, { backgroundColor: isDarkMode ? '#232838' : '#ebedeb', borderColor: colors.border }]}>
          <Svg width={18} height={18} viewBox="0 0 18 18" fill="none" style={styles.instructionsIcon}>
            <Path
              d="M1 18C0.716667 18 0.479167 17.9042 0.2875 17.7125C0.0958333 17.5208 0 17.2833 0 17V1C0 0.716667 0.0958333 0.479167 0.2875 0.2875C0.479167 0.0958333 0.716667 0 1 0H17C17.2833 0 17.5208 0.0958333 17.7125 0.2875C17.9042 0.479167 18 0.716667 18 1V13C18 13.2833 17.9042 13.5208 17.7125 13.7125C17.5208 13.9042 17.2833 14 17 14H4L1 17.25C0.916667 17.3333 0.8125 17.4125 0.6875 17.4875C0.5625 17.5625 0.433333 17.6 0.3 17.6C0.183333 17.6 0.1 17.5667 0.05 17.5C0 17.4333 0 17.3 0 17.1V18H1ZM2 13.4V14.85L3.85 13H16V2H2V13.4ZM4 9.5H14V8H4V9.5ZM4 6.75H14V5.25H4V6.75Z"
              fill={colors.textSecondary}
            />
          </Svg>
          <View style={styles.instructionsTextContainer}>
            <Text style={[styles.instructionsLabel, { color: colors.textSecondary }]}>CUSTOMER INSTRUCTIONS</Text>
            <Text style={[styles.instructionsValue, { color: colors.textPrimary }]}>{jobDetails?.delivery_instructions || 'No special instructions.'}</Text>
          </View>
        </View>

        {/* Itemized List Card */}
        <View style={[styles.orderItemsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.itemsCardHeader, { color: colors.textPrimary }]}>Items</Text>
          <View style={[styles.itemsDivider, { backgroundColor: colors.border }]} />

          {jobDetails?.items && jobDetails.items.length > 0 ? (
            jobDetails.items.map((item: any, idx: number) => (
              <React.Fragment key={idx}>
                {idx > 0 && <View style={[styles.itemRowDivider, { backgroundColor: colors.border }]} />}
                <View style={styles.itemRow}>
                  <View style={styles.itemLeftContainer}>
                    <View style={[styles.itemBullet, { backgroundColor: colors.accent }]} />
                    <Text style={[styles.itemNameText, { color: colors.textPrimary }]}>{item.name}</Text>
                  </View>
                  <Text style={[styles.itemPriceText, { color: colors.textSecondary }]}>
                    Qty: {item.quantity}
                  </Text>
                </View>
              </React.Fragment>
            ))
          ) : (
            <View style={styles.itemRow}>
              <View style={styles.itemLeftContainer}>
                <View style={[styles.itemBullet, { backgroundColor: colors.accent }]} />
                <Text style={[styles.itemNameText, { color: colors.textPrimary }]}>Order Items List</Text>
              </View>
              <Text style={[styles.itemPriceText, { color: colors.textSecondary }]}>0 x ₹0.00</Text>
            </View>
          )}
        </View>

        {/* Payment Summary Card */}
        <View style={[styles.paymentSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.paymentHeaderRow}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M3 22V2l1.5 1.5L6 2l1.5 1.5L9 2l1.5 1.5L12 2l1.5 1.5L15 2l1.5 1.5L18 2l1.5 1.5L21 2v20l-1.5-1.5L18 22l-1.5-1.5L15 22l-1.5-1.5L12 22l-1.5-1.5L9 22l-1.5-1.5L6 22l-1.5-1.5L3 22ZM17 9V7H7v2h10Zm0 4v-2H7v2h10Zm0 4v-2H7v2h10Z"
                fill={colors.accent}
              />
            </Svg>
            {jobDetails?.payment_method === 'COD' ? (
              <View style={[styles.onlineBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Text style={[styles.onlineBadgeText, { color: '#3b82f6' }]}>CASH ON DELIVERY</Text>
              </View>
            ) : (
              <View style={[styles.onlineBadge, { backgroundColor: colors.accentLight }]}>
                <Svg width={11} height={9} viewBox="0 0 11 9" fill="none" style={styles.onlineCheckIcon}>
                  <Path
                    d="M1 4.5L3.66667 7L9.5 1"
                    stroke={colors.accent}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={[styles.onlineBadgeText, { color: colors.accent }]}>PAID ONLINE</Text>
              </View>
            )}
          </View>

          <View style={[styles.itemsDivider, { backgroundColor: colors.border, marginTop: 4 }]} />

          <View style={styles.paymentRow}>
            <Text style={[styles.totalBillLabel, { color: colors.textPrimary }]}>Bill Amount</Text>
            <Text style={[styles.totalBillValue, { color: colors.accent }]}>₹{jobDetails?.to_pay || '330.00'}</Text>
          </View>
        </View>

        {/* Spacer */}
        <View style={[styles.bottomBarSpacer, { height: 75 + insets.bottom }]} />
      </ScrollView>

      {/* Premium Glassmorphism Floating Navigation Button (Bottom Right) */}
      <Pressable
        onPress={() => {
          const currentStatus = jobDetails?.status || (params.status as string);
          const shouldGoToDeliveryRoute = isPickedUp || isOutForDeliveryStatus(currentStatus);

          if (shouldGoToDeliveryRoute) {
            router.push({
              pathname: '/map',
              params: {
                orderId,
                jobId: jobDetails?.id || params.jobId,
                restaurantLat: jobDetails?.restaurant_latitude || params.restaurantLat,
                restaurantLng: jobDetails?.restaurant_longitude || params.restaurantLng,
                userLat: jobDetails?.user_latitude || params.userLat,
                userLng: jobDetails?.user_longitude || params.userLng,
              },
            });
          } else {
            router.push({
              pathname: '/arrived',
              params: {
                orderId,
                jobId: jobDetails?.id || params.jobId,
                restaurantLat: jobDetails?.restaurant_latitude || params.restaurantLat,
                restaurantLng: jobDetails?.restaurant_longitude || params.restaurantLng,
                userLat: jobDetails?.user_latitude || params.userLat,
                userLng: jobDetails?.user_longitude || params.userLng,
              },
            });
          }
        }}
        style={({ pressed }) => [
          styles.glassNavFab,
          {
            bottom: insets.bottom + 92,
            transform: [{ scale: pressed ? 0.93 : 1 }],
          },
        ]}
        hitSlop={10}
      >
        {/* Glass reflection top highlight */}
        <View style={styles.glassReflectRing} />

        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2L2 22l10-4 10 4L12 2z"
            fill="#ffffff"
            stroke="#ffffff"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>

      {/* Bottom Navigation Bar */}
      <BottomTabBar activeTab="home" onTabPress={handleTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    textAlign: 'center',
  },
  headerRightPlaceholder: {
    width: 32,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120, // ensure content is not hidden behind the fixed footer
  },
  orderHeaderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  orderIdContainer: {
    flexDirection: 'column',
  },
  orderIdLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  orderIdValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  badgeCheckIcon: {
    marginRight: 6,
  },
  statusBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  mapContainer: {
    width: '100%',
    height: 192,
    borderRadius: 24,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 24,
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFill,
  },
  floatingNavigateBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 141,
    height: 48,
    borderRadius: 9999,
    backgroundColor: '#006c49',
  },
  navigateBtnTextOverride: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#ffffff',
    textTransform: 'none',
  },
  detailsCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  storeIconContainer: {
    width: 42,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardInfoContainer: {
    flex: 1,
  },
  cardTitleText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    marginBottom: 4,
  },
  cardSubtitleText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  customerCard: {
    flexDirection: 'column',
  },
  customerHeaderRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  initialsAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  initialsText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
  },
  customerPhoneText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
    marginTop: 4,
  },
  customerActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  customerActionBtn: {
    flex: 1,
    borderRadius: 8,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInnerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnIcon: {
    marginRight: 8,
  },
  actionBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  metaBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  metaIcon: {
    marginBottom: 8,
  },
  metaLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  metaValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
  },
  earningsValueText: {
    fontFamily: 'Inter-Bold',
  },
  instructionsCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  instructionsIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  instructionsTextContainer: {
    flex: 1,
  },
  instructionsLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  instructionsValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  orderItemsCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 24,
  },
  itemsCardHeader: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    marginBottom: 8,
  },
  itemsDivider: {
    height: 1,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  itemLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  itemNameText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    flex: 1,
  },
  itemPriceText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginLeft: 8,
  },
  itemRowDivider: {
    height: 1,
  },
  paymentSummaryCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 24,
  },
  paymentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentCardTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  onlineCheckIcon: {
    marginRight: 4,
  },
  onlineBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  paymentRowLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  paymentRowValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  totalRowDivider: {
    height: 1,
    marginVertical: 12,
  },
  totalBillLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
  },
  totalBillValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
  },
  bottomBarSpacer: {
    height: 40,
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  bottomTabBarContent: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 12 : 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  tabItemActive: {
    borderRadius: 9999,
  },
  tabIconContainer: {
    width: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
  tabIconContainerActive: {
    width: 48,
  },
  tabText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  glassNavFab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(16, 185, 129, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    zIndex: 99,
  },
  glassReflectRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderTopLeftRadius: 29,
    borderTopRightRadius: 29,
  },
});

/* ─── Premium Order Details Loader ─────────────────────────────────────── */
function OrderDetailsLoader({ colors, insets }: { colors: any; insets: any }) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const dot1 = React.useRef(new Animated.Value(0.3)).current;
  const dot2 = React.useRef(new Animated.Value(0.3)).current;
  const dot3 = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    // Pulsing bike icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    // Bouncing dots
    const dotAnim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );
    Animated.parallel([
      dotAnim(dot1, 0),
      dotAnim(dot2, 200),
      dotAnim(dot3, 400),
    ]).start();
  }, []);

  const shimmerBg = colors.card;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ height: 56, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: shimmerBg }} />
        <View style={{ flex: 1, height: 16, borderRadius: 8, backgroundColor: shimmerBg, marginHorizontal: 16 }} />
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: shimmerBg }} />
      </View>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        {/* Animated Bike Icon */}
        <Animated.Text style={{ fontSize: 64, transform: [{ scale: pulseAnim }], marginBottom: 24 }}>
          🏍️
        </Animated.Text>

        {/* Loading Text */}
        <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 17, color: colors.textPrimary, marginBottom: 8 }}>
          Fetching Order Details
        </Text>
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textSecondary, marginBottom: 24 }}>
          Please wait a moment...
        </Text>

        {/* Animated Dots */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 48 }}>
          {[dot1, dot2, dot3].map((dot, i) => (
            <Animated.View
              key={i}
              style={{
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: colors.accent,
                opacity: dot,
                transform: [{ scale: dot }],
              }}
            />
          ))}
        </View>

        {/* Skeleton Cards */}
        <View style={{ width: '100%', gap: 12 }}>
          {/* Map skeleton */}
          <View style={{ width: '100%', height: 180, borderRadius: 16, backgroundColor: shimmerBg }} />
          {/* Card skeleton */}
          <View style={{ width: '100%', padding: 16, borderRadius: 16, backgroundColor: shimmerBg, gap: 10 }}>
            <View style={{ height: 12, width: '60%', borderRadius: 6, backgroundColor: colors.border }} />
            <View style={{ height: 12, width: '80%', borderRadius: 6, backgroundColor: colors.border }} />
            <View style={{ height: 12, width: '40%', borderRadius: 6, backgroundColor: colors.border }} />
          </View>
          {/* Another card */}
          <View style={{ width: '100%', padding: 16, borderRadius: 16, backgroundColor: shimmerBg, gap: 10 }}>
            <View style={{ height: 12, width: '50%', borderRadius: 6, backgroundColor: colors.border }} />
            <View style={{ height: 12, width: '70%', borderRadius: 6, backgroundColor: colors.border }} />
          </View>
        </View>
      </View>
    </View>
  );
}
