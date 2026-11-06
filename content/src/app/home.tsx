import CustomButton from '@/components/CustomButton';
import CustomInput from '@/components/CustomInput';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, RefreshControl, Modal } from 'react-native';
import { CustomAlert as Alert } from '../components/CustomAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import BottomTabBar from '@/components/BottomTabBar';
import { useAuth } from '../context/AuthContext';
import { resolveImageUrl, APP_NAME } from '../constants/constant';
import CONFIG from '../connection/config';
import { usePermissions } from '../hooks/usePermissions';
import { useOrderAlert } from '../context/OrderAlertContext';
import Constants from 'expo-constants';
import { saveNotification } from '../services/notificationStorage';

const partnerAvatarImg = require('../../assets/images/partner-avatar.png');

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning,';
  if (hour < 17) return 'Good Afternoon,';
  if (hour < 21) return 'Good Evening,';
  return 'Good Night,';
};

const formatLastLogin = (dateTimeStr: string) => {
  if (!dateTimeStr) return '---';
  try {
    // Replace space with 'T' to parse consistently in both Android & iOS JS engine engines
    const date = new Date(dateTimeStr.replace(' ', 'T'));
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return dateTimeStr;
  }
};

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const { partner, updatePartnerState } = useAuth();

  // Request notification + location permissions on first load
  usePermissions();

  // Interactive state
  const [isOnline, setIsOnline] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  // Sync online status when partner profile is loaded
  useEffect(() => {
    if (partner) {
      setIsOnline(partner.is_online == 1);
    }
  }, [partner]);
  // Search query state
  const [searchQuery, setSearchQuery] = useState('');
  // Tab state
  const [activeTab, setActiveTab] = useState('completed');

  // Stats State
  const [earnings, setEarnings] = useState(0);
  const [deliveries, setDeliveries] = useState(0);
  const wallet = parseFloat(partner?.total_earnings || '0');

  // Stats state
  const [todayEarnings, setTodayEarnings] = useState('0.00');
  const [todayCompletedCount, setTodayCompletedCount] = useState(0);

  // Delivery jobs list from DB
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [completedOrders, setCompletedOrders] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // New Order Requests Queue (Pending, partner_id = 0)
  const [requestQueue, setRequestQueue] = useState<any[]>([]);
  const [declinedRequests, setDeclinedRequests] = useState<number[]>([]);

  // Global Order Alert Context
  const { showOrderAlert } = useOrderAlert();

  // Trigger Demo Alert
  const handleTriggerDemoOrderAlert = () => {
    showOrderAlert({
      id: 9999,
      job_id: 9999,
      custom_order_id: '9999',
      restaurant_name: 'Foodies Express Store',
      restaurant_address: 'Shop #12, Commercial Market, MG Road, Bangalore',
      delivery_address: 'Flat 402, Sunshine Apartments, Indiranagar, Bangalore',
      user_name: 'Rahul Sharma',
      estimated_distance: '3.5',
      commission_rate: '15.00',
      min_commission_amount: '35.00',
      payout_amount: '52.50',
      status: 'PENDING',
    });
  };

  // Filter completed and pending orders based on search query
  const filteredOrders = completedOrders.filter(order => {
    const idStr = String(order?.custom_order_id || order?.id || '').toLowerCase();
    const storeStr = String(order?.restaurant_name || order?.store || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return idStr.includes(query) || storeStr.includes(query);
  });

  const filteredPendingOrders = pendingOrders.filter(order => {
    const idStr = String(order?.custom_order_id || order?.id || '').toLowerCase();
    const storeStr = String(order?.restaurant_name || order?.store || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return idStr.includes(query) || storeStr.includes(query);
  });

  // Compute the current unassigned request displayed in the New Request card
  const visibleRequests = requestQueue.filter(req => req && !declinedRequests.includes(req.id));
  const currentRequest = visibleRequests[0] || null;

  // Compute active order dynamically based on the first pending order
  const activeOrder = pendingOrders.length > 0 ? {
    id: pendingOrders[0].custom_order_id || pendingOrders[0].id || '#ORDER',
    dbId: pendingOrders[0].db_id || pendingOrders[0].id,
    status: pendingOrders[0].status || 'ACCEPTED',
    pickup: pendingOrders[0].restaurant_name || pendingOrders[0].store || 'Store',
    pickupAddr: pendingOrders[0].restaurant_address || pendingOrders[0].pickup_address || 'Store Location',
    dropoff: 'Customer Location',
    dropoffAddr: pendingOrders[0].delivery_address || 'Customer Location',
    amount: parseFloat(String(pendingOrders[0].payout_amount || pendingOrders[0].amount || pendingOrders[0].to_pay || '0').replace('₹', '')) || 0,
    user_phone: pendingOrders[0].user_phone || ''
  } : null;

  // Swiper configuration mapper based on active order status
  const getActiveSwipeConfig = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return {
          text: 'Swipe to Arrive at Store',
          color: '#3b82f6', // Premium Blue
          nextStatus: 'AT_STORE'
        };
      case 'AT_STORE':
        return {
          text: 'Swipe to Confirm Pickup',
          color: '#6366f1', // Premium Indigo
          nextStatus: 'PICKED_UP'
        };
      case 'PICKED_UP':
      case 'OUT_FOR_DELIVERY':
        return {
          text: 'Swipe to Arrive at Customer',
          color: '#f59e0b', // Premium Amber
          nextStatus: 'ARRIVED'
        };
      case 'ARRIVED':
        return {
          text: 'Swipe to Complete Delivery',
          color: '#10b981', // Premium Green
          nextStatus: 'DELIVERED'
        };
      default:
        return null;
    }
  };

  // Helper to extract phone and split address into 2 lines + phone
  const parseDropoffAddress = (rawAddress: string) => {
    if (!rawAddress) return { line1: '', line2: '', phone: '' };

    const phoneRegex = /(?:Contact|Phone|Mobile|Tel)[:\s-]*(\+?\d[\d\s-]{8,14}\d)/i;
    const phoneMatch = rawAddress.match(phoneRegex);
    const phone = phoneMatch ? phoneMatch[1].trim() : '';

    const cleanAddress = rawAddress
      .replace(/(?:Contact|Phone|Mobile|Tel)[:\s-]*\+?\d[\d\s-]{8,14}\d/gi, '')
      .trim()
      .replace(/,\s*$/, '');

    const parts = cleanAddress.split(/[\r\n,]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return { line1: '', line2: '', phone };
    if (parts.length === 1) return { line1: parts[0], line2: '', phone };
    if (parts.length === 2) return { line1: parts[0], line2: parts[1], phone };
    if (parts.length === 3) return { line1: parts[0] + ', ' + parts[1], line2: parts[2], phone };

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
      return { line1, line2, phone };
    } else {
      const line1 = parts.slice(0, 2).join(', ');
      const line2 = parts.slice(2).join(', ');
      return { line1, line2, phone };
    }
  };

  const handleUpdateJobStatus = async (jobId: number, status: string) => {
    if (!partner?.id) return;
    try {
      const response = await fetch(CONFIG.ENDPOINTS.UPDATE_JOB_STATUS, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({
          partner_id: partner.id,
          job_id: jobId,
          status: status
        })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', `Status updated successfully!`);
        await fetchHomeStats();
      } else {
        Alert.alert('Error', data.message || 'Failed to update status.');
      }
    } catch (error) {
      console.error('Error updating job status:', error);
      Alert.alert('Error', 'Connection failed. Please try again.');
    }
  };

  const fetchHomeStats = async () => {
    if (!partner?.id) return;
    try {
      // 1. Refresh partner profile to get updated total_earnings and cash_in_hand
      const profileResponse = await fetch(CONFIG.ENDPOINTS.PROFILE, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({ partner_id: partner.id }),
      });
      const profileData = await profileResponse.json();
      if (profileResponse.ok && profileData.success) {
        await updatePartnerState(profileData.user);
      }

      // 2. Refresh home stats
      const response = await fetch(CONFIG.ENDPOINTS.GET_HOME_STATS, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({ partner_id: partner.id }),
      });
      const data = await response.json();
      if (data.success) {
        setEarnings(parseFloat(data.today_earnings) || 0);
        setDeliveries(parseInt(data.today_deliveries, 10) || 0);
        setCompletedOrders(data.completed_jobs || []);
        setPendingOrders(data.pending_jobs || []);
        setRequestQueue(data.request_queue || []);
      }
    } catch (error) {
      console.error('Error fetching home stats/profile:', error);
    }
  };

  useEffect(() => {
    fetchHomeStats();
  }, [partner?.id]);

  const handleDeclineRequest = () => {
    if (currentRequest) {
      setDeclinedRequests(prev => [...prev, currentRequest.id]);
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentRequest || !partner?.id) return;
    try {
      const response = await fetch(CONFIG.ENDPOINTS.ACCEPT_DELIVERY_JOB, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({
          partner_id: partner.id,
          job_id: currentRequest.id
        })
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Order accepted successfully!');
        await fetchHomeStats();
      } else {
        Alert.alert('Error', data.message || 'Failed to accept order.');
        await fetchHomeStats();
      }
    } catch (error) {
      console.error('Error accepting job on home:', error);
      Alert.alert('Error', 'Connection failed. Please try again.');
    }
  };

  const toggleOnlineSwitch = async () => {
    const isApproved = partner?.approve_status === 'approved';
    if (!isApproved) {
      setShowAlert(true);
      return;
    }

    if (isToggling) return;

    const originalState = isOnline;
    const nextState = !isOnline;

    // Optimistically toggle UI immediately for lag-free performance
    setIsOnline(nextState);
    setIsToggling(true);

    try {
      const response = await fetch(CONFIG.ENDPOINTS.TOGGLE_STATUS, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({
          partner_id: partner?.id,
          is_online: nextState ? 1 : 0
        }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        await updatePartnerState({ is_online: nextState ? 1 : 0 });
      } else {
        // Revert on API failure
        setIsOnline(originalState);
        Alert.alert('Error', data.message || 'Failed to update online status.');
      }
    } catch (error) {
      console.error('Toggle status error:', error);
      // Revert on network exception
      setIsOnline(originalState);
      Alert.alert('Error', 'Network request failed. Please check connection.');
    } finally {
      setIsToggling(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!partner?.id) return;
    setRefreshing(true);
    try {
      const response = await fetch(CONFIG.ENDPOINTS.PROFILE, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({ partner_id: partner.id }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        await updatePartnerState(data.user);
      } else {
        console.log('Failed to refresh profile:', data.message);
      }

      await fetchHomeStats();
    } catch (error) {
      console.log('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header - Top App Bar */}
      <View style={[styles.topAppBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.appBarContent}>
          {/* Left:  Mtb Express Logo Badge + App Title */}
          <View style={styles.appBrandContainer}>
            <Image
              source={require('../../assets/images/exhome_logo.png')}
              style={{ width: 34, height: 34, borderRadius: 8 }}
              resizeMode="contain"
            />
            <Text
              style={[styles.appBarTitle, { color: colors.accent }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {APP_NAME}
            </Text>
          </View>

          {/* Right: Demo Alert Icon + Notification Bell */}
          <View style={styles.appBarActions}>
            <Pressable
              onPress={handleTriggerDemoOrderAlert}
              style={[styles.notificationButton, { backgroundColor: 'rgba(0, 200, 150, 0.15)' }]}
              hitSlop={10}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                  fill="#00C896"
                />
              </Svg>
            </Pressable>

            <Pressable
              onPress={() => router.push('/notifications')}
              style={styles.notificationButton}
              hitSlop={10}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
                  stroke={colors.textSecondary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <View style={styles.notificationBadge} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={true}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
      >
        {/* Profile Card / Header Section */}
        <View style={[styles.profileSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.profileContainer}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.iconBg, borderColor: colors.accent }]}>
              <Image
                source={partner?.profile_photo ? { uri: resolveImageUrl(partner.profile_photo) } : partnerAvatarImg}
                style={styles.avatarImage}
              />
              <View style={[styles.avatarStatusBadge, { backgroundColor: isOnline ? '#10b981' : colors.textMuted, borderColor: colors.card }]} />
            </View>

            <View style={styles.profileInfoContainer}>
              <Text style={[styles.welcomeText, { color: colors.textSecondary }]} numberOfLines={1}>{getGreeting()}</Text>
              <Text style={[styles.partnerNameText, { color: colors.textPrimary }]} numberOfLines={1}>
                {partner?.name || 'Partner'}
              </Text>

              <View style={styles.badgesRow}>
                {partner?.approve_status === 'approved' ? (
                  <View style={[styles.verifiedBadge, { backgroundColor: colors.accentLight }]}>
                    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M20 6L9 17L4 12"
                        stroke={colors.accent}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={[styles.verifiedText, { color: colors.accent }]}>Verified</Text>
                  </View>
                ) : (
                  <View style={[styles.verifiedBadge, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                    <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M18 6L6 18M6 6l12 12"
                        stroke="#ef4444"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={[styles.verifiedText, { color: '#ef4444' }]}>Unverified</Text>
                  </View>
                )}

                <View style={styles.ratingBadge}>
                  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                      fill="#f59e0b"
                    />
                  </Svg>
                  <Text style={[styles.ratingText, { color: colors.textSecondary }]}>4.9</Text>
                </View>
              </View>

              {partner?.last_login && (
                <Text style={[styles.lastLoginText, { color: colors.textMuted }]} numberOfLines={1}>
                  Last Login: {formatLastLogin(partner.last_login)}
                </Text>
              )}
            </View>
          </View>

          {/* Custom Switch Toggle */}
          <View style={styles.toggleContainer}>
            <Text style={[styles.toggleLabel, { color: isOnline ? colors.accent : colors.textSecondary }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Switch
              trackColor={{ false: colors.border, true: '#82f5c1' }}
              thumbColor={isOnline ? colors.accent : '#a1a1aa'}
              ios_backgroundColor={colors.border}
              onValueChange={toggleOnlineSwitch}
              value={isOnline}
            />
          </View>
        </View>

        {/* Stats Grid / Section - Stats Overview */}
        <View style={styles.statsGrid}>
          {/* Earnings Card */}
          <View style={[styles.statCard, styles.earningsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>TODAY'S EARNINGS</Text>
            <Text style={[styles.statValue, { color: colors.accent }]}>
              ₹{earnings.toFixed(2)}
            </Text>
          </View>

          {/* Bottom row stats */}
          <View style={styles.statsBottomRow}>
            {/* Deliveries Card */}
            <View style={[styles.statCardHalf, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>DELIVERIES</Text>
              <Text style={[styles.statValueCompact, { color: colors.textPrimary }]}>{deliveries}</Text>
            </View>
            {/* Wallet Card */}
            <View style={[styles.statCardHalf, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>WALLET</Text>
              <Text style={[styles.statValueCompact, { color: colors.textPrimary }]}>₹{wallet}</Text>
            </View>
          </View>
        </View>

        {/* Section - Active Context / Orders */}
        <View style={styles.activeSection}>
          {/* New Request Alert */}
          {isOnline && currentRequest && !activeOrder && (
            <View style={[styles.newRequestCard, { backgroundColor: isDarkMode ? '#142a22' : '#e6fdf3', borderColor: colors.accent }]}>
              {/* Background Route Graphic in Top Right */}
              <View style={styles.newRequestCardDecoration}>
                <Svg width={100} height={100} viewBox="0 0 100 100" fill="none">
                  <Path
                    d="M10,30 L90,30 M40,10 L40,90"
                    stroke={colors.accent}
                    strokeWidth="8"
                    strokeLinecap="round"
                    opacity="0.08"
                  />
                  <Path
                    d="M10,60 L90,60"
                    stroke={colors.accent}
                    strokeWidth="8"
                    strokeLinecap="round"
                    opacity="0.08"
                  />
                  <Circle cx="40" cy="30" r="10" fill={colors.accent} opacity="0.08" />
                </Svg>
              </View>
              <View style={styles.newRequestHeader}>
                <View style={styles.pulseDotContainer}>
                  <View style={[styles.pulseDotRadar, { backgroundColor: colors.accent }]} />
                  <View style={[styles.pulseDot, { backgroundColor: colors.accent }]} />
                </View>
                <Text style={[styles.newRequestTitle, { color: colors.accent }]} numberOfLines={1}>
                  New Request: {currentRequest.pickup}
                </Text>
              </View>

              <View style={styles.newRequestDetails}>
                <View style={styles.newRequestEarnings}>
                  <Text style={[styles.newRequestAmount, { color: colors.textPrimary }]}>₹{parseFloat(currentRequest.amount).toFixed(2)}</Text>
                  <Text style={[styles.newRequestEarningsLabel, { color: colors.textSecondary }]}>Est. Earning</Text>
                </View>

                <View style={styles.newRequestDistanceContainer}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                      fill={colors.textSecondary}
                    />
                  </Svg>
                  <Text style={[styles.newRequestDistanceText, { color: colors.textSecondary }]}>
                    {currentRequest.time_away} mins away ({currentRequest.distance} km)
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.requestActionsRow}>
                <View style={styles.actionBtnWrapper}>
                  <CustomButton
                    title="Decline"
                    onPress={handleDeclineRequest}
                    style={[styles.declineButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                    textStyle={[styles.declineButtonText, { color: colors.textPrimary }]}
                  />
                </View>
                <View style={styles.actionBtnWrapper}>
                  <CustomButton
                    title="Accept"
                    variant="primary"
                    onPress={handleAcceptRequest}
                    style={styles.acceptButton}
                    textStyle={styles.acceptButtonText}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Active Order In Progress */}
          {activeOrder && (
            <View style={[styles.activeOrderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.activeOrderHeader}>
                <Text
                  style={[styles.activeOrderTitle, { color: colors.textPrimary }]}
                  numberOfLines={2}
                >
                  Active Order {activeOrder.id}
                </Text>
                <View style={[styles.inProgressBadge, { backgroundColor: colors.iconBg }]}>
                  <Text style={[styles.inProgressText, { color: colors.textSecondary }]}>IN PROGRESS</Text>
                </View>
              </View>

              {/* Steps timeline */}
              <View style={styles.timelineRowContainer}>
                {/* Left Timeline Column (Dots and Line) */}
                <View style={styles.timelineLeftCol}>
                  <View style={[styles.timelineDotPickup, { backgroundColor: colors.accent }]} />
                  <View style={[styles.timelineLineConnector, { backgroundColor: colors.border }]} />
                  <View style={[styles.timelineDotDropoff, { backgroundColor: colors.card, borderColor: colors.accent }]} />
                </View>

                {/* Right Text Column */}
                <View style={styles.timelineRightCol}>
                  {/* Pickup Text */}
                  <View style={styles.timelineStepBlock}>
                    <Text style={[styles.timelineStepLabel, { color: colors.textSecondary }]}>PICKUP</Text>
                    <Text style={[styles.timelineStepTitle, { color: colors.textPrimary }]}>{activeOrder.pickup}</Text>
                    <Text style={[styles.timelineStepSub, { color: colors.textSecondary }]}>{activeOrder.pickupAddr}</Text>
                  </View>

                  {/* Drop-off Text */}
                  <View>
                    <Text style={[styles.timelineStepLabel, { color: colors.textSecondary }]}>DROP-OFF</Text>
                    <Text style={[styles.timelineStepTitle, { color: colors.textPrimary }]}>{activeOrder.dropoff}</Text>
                    {(() => {
                      const { line1, line2, phone } = parseDropoffAddress(activeOrder.dropoffAddr);
                      return (
                        <View style={{ gap: 2, marginTop: 4 }}>
                          <Text style={[styles.timelineStepSub, { color: colors.textSecondary }]}>
                            {line1}
                          </Text>
                          {line2 ? (
                            <Text style={[styles.timelineStepSub, { color: colors.textSecondary }]}>
                              {line2}
                            </Text>
                          ) : null}
                          {phone ? (
                            <Text style={[styles.timelineStepSub, { color: colors.textSecondary, fontFamily: 'Inter-Medium' }]}>
                              Contact No: {phone}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <CustomButton
                title="View Details →"
                onPress={() => router.push({
                  pathname: '/order_details',
                  params: { 
                    orderId: activeOrder.id, 
                    jobId: activeOrder.dbId,
                    deliveryAddress: activeOrder.dropoffAddr,
                    userPhone: activeOrder.user_phone || ''
                  }
                })}
                style={[styles.viewDetailsBtn, { backgroundColor: colors.accentLight, borderColor: colors.accent }]}
                textStyle={[styles.viewDetailsBtnText, { color: colors.accent }]}
              />
            </View>
          )}

          {/* Offline / Idle Banner */}
          {(!isOnline || (!currentRequest && !activeOrder)) && (
            <View style={[styles.idleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.idleText, { color: colors.textSecondary }]}>
                {!isOnline
                  ? 'You are currently Offline. Toggle Online to start receiving order requests!'
                  : 'Waiting for new order requests...'}
              </Text>
            </View>
          )}
        </View>

        {/* Section - Recent Activity Tabs & History */}
        <View style={[styles.historySection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>Recent Activity</Text>

          {/* Search bar using CustomInput */}
          <CustomInput
            placeholder="Search orders by ID or store..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={styles.searchBar}
          />

          {/* Tabs header */}
          <View style={[styles.tabHeaderBorder, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={() => setActiveTab('completed')}
              style={[styles.tabButton, activeTab === 'completed' && [styles.tabButtonActive, { borderBottomColor: colors.accent }]]}
            >
              <Text style={[styles.tabButtonText, { color: colors.textSecondary }, activeTab === 'completed' && { color: colors.accent }]}>
                Completed
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('pending')}
              style={[styles.tabButton, activeTab === 'pending' && [styles.tabButtonActive, { borderBottomColor: colors.accent }]]}
            >
              <Text style={[styles.tabButtonText, { color: colors.textSecondary }, activeTab === 'pending' && { color: colors.accent }]}>
                Pending
              </Text>
            </Pressable>
          </View>

          {/* Tab content */}
          {activeTab === 'completed' ? (
            <View style={styles.listContainer}>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order, index) => (
                  <View key={index} style={[styles.historyItemCard, { borderBottomColor: colors.background }]}>
                    <View style={styles.historyItemLeft}>
                      <View style={[styles.historyIconBg, { backgroundColor: colors.accentLight }]}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M20 6L9 17L4 12"
                            stroke={colors.accent}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
                      <View style={styles.historyItemTextContainer}>
                        <Text style={[styles.historyItemTitle, { color: colors.textPrimary }]}>Order {order.id}</Text>
                        <Text style={[styles.historyItemSub, { color: colors.textSecondary }]}>{order.time} • {order.store}</Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.historyItemAmount, { color: colors.accent }]}
                    >
                      {order.amount}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.noHistoryText, { color: colors.textSecondary }]}>No orders match your search.</Text>
              )}
            </View>
          ) : (
            <View style={styles.listContainer}>
              {filteredPendingOrders.length > 0 ? (
                filteredPendingOrders.map((order, index) => (
                  <View key={index} style={[styles.historyItemCard, { borderBottomColor: colors.background }]}>
                    <View style={styles.historyItemLeft}>
                      <View style={[styles.historyIconBg, { backgroundColor: colors.accentLight }]}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M12 8V12L15 15"
                            stroke={colors.accent}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                          <Circle cx="12" cy="12" r="9" stroke={colors.accent} strokeWidth="2.5" />
                        </Svg>
                      </View>
                      <View style={styles.historyItemTextContainer}>
                        <Text style={[styles.historyItemTitle, { color: colors.textPrimary }]}>Order {order.id}</Text>
                        <Text style={[styles.historyItemSub, { color: colors.textSecondary }]}>Accepted • {order.store}</Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.historyItemAmount, { color: colors.accent }]}
                    >
                      {order.amount}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.noHistoryText, { color: colors.textSecondary }]}>No pending orders.</Text>
              )}
            </View>
          )}

          <Pressable onPress={() => router.push('/orders')} style={styles.viewHistoryButton}>
            <Text style={[styles.viewHistoryBtnText, { color: colors.accent }]}>VIEW ALL HISTORY</Text>
          </Pressable>
        </View>

        {/* Extra spacer at the bottom to prevent overlay overlap */}
        <View style={[styles.bottomBarSpacer, { height: 75 + insets.bottom }]} />
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <BottomTabBar activeTab="home" />

      {/* Premium Access Denied Modal */}
      <Modal
        visible={showAlert}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAlert(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.alertContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Warning Icon Container */}
            <View style={[styles.warningIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 9v4M12 17h.01"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx={12} cy={12} r={9} stroke="#ef4444" strokeWidth="2.5" />
              </Svg>
            </View>

            {/* Title */}
            <Text style={[styles.alertTitle, { color: colors.textPrimary }]}>
              Verification Required
            </Text>

            {/* Standard Message */}
            <Text style={[styles.alertMessage, { color: colors.textSecondary }]}>
              Your account is currently under review. Please contact the administrator to activate your profile and start accepting deliveries.
            </Text>

            {/* Action Button */}
            <Pressable
              onPress={() => setShowAlert(false)}
              style={[styles.alertButton, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.alertButtonText}>Got It</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  demoAlertButton: {
    backgroundColor: '#00C896',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoAlertText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertContainer: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  warningIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  alertTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 19,
    textAlign: 'center',
    marginBottom: 10,
  },
  alertMessage: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  alertButton: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertButtonText: {
    fontFamily: 'Inter-SemiBold',
    color: '#ffffff',
    fontSize: 15,
  },
  safeArea: {
    flex: 1,
  },
  topAppBar: {
    height: 64,
    borderBottomWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  appBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
    gap: 8,
  },
  appBrandContainer: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appBarActions: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  placeholderButton: {
    width: 32,
  },
  appBarTitle: {
    flexShrink: 1,
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    letterSpacing: -0.6,
  },
  notificationButton: {
    width: 32,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ba1a1a',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 96,
  },
  profileSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  profileContainer: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    flexShrink: 0,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    resizeMode: 'cover',
  },
  avatarStatusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  profileInfoContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  welcomeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 18,
  },
  partnerNameText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 9999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  verifiedText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  lastLoginText: {
    flexShrink: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 6,
  },
  toggleContainer: {
    width: 54,
    flexShrink: 0,
    alignItems: 'center',
    gap: 4,
  },
  toggleLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  statsGrid: {
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  earningsCard: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  statsBottomRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCardHalf: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
  },
  statValueCompact: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  activeSection: {
    marginBottom: 24,
  },
  newRequestCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  newRequestCardDecoration: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 100,
    height: 100,
    overflow: 'hidden',
  },
  newRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pulseDotContainer: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseDotRadar: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    opacity: 0.4,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  newRequestTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  newRequestDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  newRequestEarnings: {
    gap: 2,
  },
  newRequestAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
  },
  newRequestEarningsLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  newRequestDistanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newRequestDistanceText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  requestActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtnWrapper: {
    flex: 1,
  },
  declineButton: {
    borderWidth: 1,
    borderRadius: 12,
    height: 50,
    shadowColor: 'transparent',
    elevation: 0,
  },
  declineButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
  },
  acceptButton: {
    borderRadius: 12,
    height: 50,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  acceptButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#ffffff',
  },
  activeOrderCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  activeOrderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  activeOrderTitle: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
  },
  inProgressBadge: {
    flexShrink: 0,
    borderRadius: 9999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  inProgressText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  timelineRowContainer: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 20,
  },
  timelineLeftCol: {
    width: 24,
    alignItems: 'center',
  },
  timelineRightCol: {
    flex: 1,
    paddingLeft: 12,
  },
  timelineStepBlock: {
    marginBottom: 20,
  },
  timelineDotPickup: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineDotDropoff: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  timelineLineConnector: {
    width: 2,
    height: 54,
    marginVertical: 4,
  },
  timelineStepLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  timelineStepTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    marginBottom: 2,
  },
  timelineStepSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  viewDetailsBtn: {
    borderWidth: 1,
    borderRadius: 12,
    height: 50,
    width: '100%',
    marginTop: 8,
    shadowColor: 'transparent',
    elevation: 0,
  },
  viewDetailsBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  idleCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idleText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  historySection: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionHeader: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    marginBottom: 12,
  },
  searchBar: {
    marginBottom: 16,
    height: 48,
    shadowColor: 'transparent',
    elevation: 0,
  },
  tabHeaderBorder: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 16,
    gap: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {},
  tabButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  tabButtonTextActive: {},
  listContainer: {
    gap: 12,
    marginBottom: 16,
  },
  historyItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  historyItemLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  historyItemTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  historyIconBg: {
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyItemTitle: {
    flexShrink: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    lineHeight: 21,
  },
  historyItemSub: {
    flexShrink: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 19,
  },
  historyItemAmount: {
    width: 70,
    flexShrink: 0,
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    textAlign: 'right',
  },
  noHistoryText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  viewHistoryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  viewHistoryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  bottomBarSpacer: {
    height: 24,
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
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
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
});
