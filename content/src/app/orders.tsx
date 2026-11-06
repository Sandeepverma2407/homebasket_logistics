import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Platform, Modal, ActivityIndicator, RefreshControl, Animated } from 'react-native';
import { CustomAlert as Alert } from '../components/CustomAlert';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import CustomButton from '../components/CustomButton';
import CustomInput from '../components/CustomInput';
import { useTheme } from '../context/ThemeContext';
import BottomTabBar from '../components/BottomTabBar';
import { useAuth } from '../context/AuthContext';
import CONFIG from '../connection/config';
import SwipeButton from '../components/SwipeButton';

interface Order {
  id: string;
  dbId: number;
  paymentMethod: 'ONLINE' | 'COD';
  status: 'DELIVERED' | 'CANCELLED' | 'PENDING' | 'ACCEPTED' | 'NEW';
  value: string;
  timestamp: string;
  pickupStore: string;
  pickupLocation: string;
  deliveryLocation: string;
  period: 'today' | 'week' | 'month';
  date: string; // YYYY-MM-DD
  userPhone?: string;
}

const getRelativeDateString = (daysOffset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysOffset);
  return d.toISOString().split('T')[0];
};

const getRelativeTimestampString = (daysOffset: number, timeStr: string) => {
  if (daysOffset === 0) {
    return `Today • ${timeStr}`;
  } else if (daysOffset === 1) {
    return `Yesterday • ${timeStr}`;
  } else {
    const d = new Date();
    d.setDate(d.getDate() - daysOffset);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} • ${timeStr}`;
  }
};

interface Activity {
  id: string;
  orderId: string;
  type: 'RECEIVED' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';
  message: string;
  timestamp: string;
  period: 'today' | 'week' | 'month';
  date: string;
}

const formatDateDisplay = (dateStr: string) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const month = months[parseInt(parts[1], 10) - 1];
    const day = parts[2];
    return `${day} ${month}, ${year}`;
  }
  return dateStr;
};

const formatAddress = (rawAddress: string) => {
  if (!rawAddress) return { firstLine: '', secondLine: '', thirdLine: '' };
  const lines = rawAddress.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  let houseLine = '';
  let landmarkLine = '';
  let otherLines: string[] = [];
  let contactLine = '';
  
  lines.forEach(line => {
    const lLower = line.toLowerCase();
    if (lLower.startsWith('house') || lLower.startsWith('flat') || lLower.includes('house/flat')) {
      houseLine = line;
    } else if (lLower.startsWith('landmark')) {
      landmarkLine = line;
    } else if (lLower.startsWith('contact')) {
      contactLine = line;
    } else {
      otherLines.push(line);
    }
  });

  const firstLineParts = [];
  if (houseLine) firstLineParts.push(houseLine);
  if (landmarkLine) firstLineParts.push(landmarkLine);
  const firstLine = firstLineParts.join(', ');

  const secondLine = otherLines.join(', ');
  const thirdLine = contactLine;

  return { firstLine, secondLine, thirdLine };
};

export default function OrdersScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const { partner } = useAuth();

  // Loading and refreshing states
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Search query state
  const [searchQuery, setSearchQuery] = useState('');
  // Filter Chip selection state ('all' | 'today' | 'week' | 'month' | 'custom')
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  // Status filter state ('ALL' | 'NEW' | 'ACCEPTED' | 'DELIVERED')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'ACCEPTED' | 'DELIVERED'>('ALL');
  // Tab state ('orders' | 'activity')
  const [activeTab, setActiveTab] = useState<'orders' | 'activity'>('orders');
  // Header filter dropdown visibility state
  const [filterDropdownVisible, setFilterDropdownVisible] = useState(false);

  // Dynamic state list of orders and activities
  const [orders, setOrders] = useState<Order[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  // DateTime and Period Helpers
  const formatTimeTo12Hour = (dateTimeStr: string) => {
    try {
      const date = new Date(dateTimeStr.replace(' ', 'T'));
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
      return '';
    }
  };

  const getRelativeTimestampStringForDate = (dateTimeStr: string) => {
    try {
      const parts = dateTimeStr.split(' ');
      const dateStr = parts[0];
      const timeStr = formatTimeTo12Hour(dateTimeStr);
      
      const jobDate = new Date(dateStr);
      jobDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - jobDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return `Today • ${timeStr}`;
      } else if (diffDays === 1) {
        return `Yesterday • ${timeStr}`;
      } else {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[jobDate.getMonth()]} ${jobDate.getDate()}, ${jobDate.getFullYear()} • ${timeStr}`;
      }
    } catch (e) {
      return dateTimeStr;
    }
  };

  const getPeriodFromDate = (dateStr: string): 'today' | 'week' | 'month' => {
    try {
      const jobDate = new Date(dateStr);
      jobDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - jobDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return 'today';
      }
      if (diffDays <= 7) {
        return 'week';
      }
      return 'month';
    } catch (e) {
      return 'month';
    }
  };

  // Fetch Delivery Jobs from PHP backend
  const fetchJobs = async (showLoading = true) => {
    if (!partner?.id) return;
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(CONFIG.ENDPOINTS.GET_DELIVERY_JOBS, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({ partner_id: partner.id }),
      });
      const data = await response.json();
      if (data.success && data.jobs) {
        // Map database jobs to App Order interface
        const mappedOrders: Order[] = data.jobs.map((job: any) => {
          let appStatus: Order['status'] = 'NEW';
          if (job.status === 'PENDING') {
            appStatus = 'NEW';
          } else if (job.status === 'ACCEPTED' || job.status === 'AT_STORE' || job.status === 'PICKED_UP' || job.status === 'OUT_FOR_DELIVERY' || job.status === 'ARRIVED') {
            appStatus = 'ACCEPTED';
          } else if (job.status === 'DELIVERED') {
            appStatus = 'DELIVERED';
          } else if (job.status === 'CANCELLED') {
            appStatus = 'CANCELLED';
          }

          const jobDate = (job.status === 'DELIVERED' && job.delivered_at) 
            ? job.delivered_at.split(' ')[0] 
            : job.created_at.split(' ')[0];

          const rawJobNo = job.job_no || (job.custom_order_id ? job.custom_order_id.replace(/^#*(JOB-)?/i, '') : job.id);
          const displayId = `#JOB-${rawJobNo}`;

          return {
            id: displayId,
            dbId: parseInt(job.id, 10),
            paymentMethod: job.payment_method === 'ONLINE' ? 'ONLINE' : 'COD',
            status: appStatus,
            value: `₹${parseFloat(job.payout_amount).toFixed(2)}`,
            timestamp: getRelativeTimestampStringForDate((job.status === 'DELIVERED' && job.delivered_at) ? job.delivered_at : job.created_at),
            pickupStore: job.restaurant_name,
            pickupLocation: `${job.restaurant_address}, ${job.restaurant_city}`,
            deliveryLocation: job.delivery_address,
            period: getPeriodFromDate(jobDate),
            date: jobDate,
            userPhone: job.user_phone || '',
          };
        });

        setOrders(mappedOrders);

        // Generate activities dynamically from delivery jobs list
        const mappedActivities: Activity[] = [];
        data.jobs.forEach((job: any) => {
          const rawJobNo = job.job_no || (job.custom_order_id ? job.custom_order_id.replace(/^#*(JOB-)?/i, '') : job.id);
          const orderIdStr = `#JOB-${rawJobNo}`;
          const jobDate = (job.status === 'DELIVERED' && job.delivered_at) 
            ? job.delivered_at.split(' ')[0] 
            : job.created_at.split(' ')[0];
          const timestampStr = getRelativeTimestampStringForDate((job.status === 'DELIVERED' && job.delivered_at) ? job.delivered_at : job.created_at);
          const periodStr = getPeriodFromDate(jobDate);

          mappedActivities.push({
            id: `act-recv-${job.id}`,
            orderId: orderIdStr,
            type: 'RECEIVED',
            message: `New order ${orderIdStr} received from ${job.restaurant_name}`,
            timestamp: timestampStr,
            period: periodStr,
            date: jobDate
          });

          if (job.status !== 'PENDING' && job.status !== 'CANCELLED') {
            mappedActivities.push({
              id: `act-acc-${job.id}`,
              orderId: orderIdStr,
              type: 'ACCEPTED',
              message: `You accepted order ${orderIdStr} from ${job.restaurant_name}`,
              timestamp: timestampStr,
              period: periodStr,
              date: jobDate
            });
          }

          if (job.status === 'DELIVERED') {
            mappedActivities.push({
              id: `act-delv-${job.id}`,
              orderId: orderIdStr,
              type: 'DELIVERED',
              message: `Order ${orderIdStr} delivered to location`,
              timestamp: timestampStr,
              period: periodStr,
              date: jobDate
            });
          }

          if (job.status === 'CANCELLED') {
            mappedActivities.push({
              id: `act-canc-${job.id}`,
              orderId: orderIdStr,
              type: 'CANCELLED',
              message: `Order ${orderIdStr} was cancelled`,
              timestamp: timestampStr,
              period: periodStr,
              date: jobDate
            });
          }
        });
        setActivities(mappedActivities);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      Alert.alert('Error', 'Failed to fetch orders from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [partner?.id]);

  // Helper to determine card background color based on status selection
  const getSelectedCardBg = (status: 'NEW' | 'ACCEPTED' | 'DELIVERED') => {
    if (isDarkMode) {
      if (status === 'NEW') return '#2c1e15';      // Solid dark orange tint
      if (status === 'ACCEPTED') return '#17253b'; // Solid dark blue tint
      return '#0f2719';                           // Solid dark green tint
    } else {
      if (status === 'NEW') return '#fff7ed';      // Solid light orange cream
      if (status === 'ACCEPTED') return '#eff6ff'; // Solid light blue cream
      return '#f0fdf4';                           // Solid light green cream
    }
  };

  // Custom confirmation modal states
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [orderToAccept, setOrderToAccept] = useState<string | null>(null);

  // Toast notification states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = React.useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    // Fade in
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      // Wait 2.2 seconds, then fade out
      setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          setToastMessage(null);
        });
      }, 2200);
    });
  };

  // Trigger custom confirmation Modal
  const handleAcceptOrder = (orderId: string) => {
    setOrderToAccept(orderId);
    setConfirmModalVisible(true);
  };

  // Perform acceptance on confirm (posts to accept_delivery_job.php API)
  const confirmAcceptOrder = async () => {
    if (!orderToAccept) return;
    const orderIdStr = orderToAccept;
    const targetOrder = orders.find(o => o.id === orderIdStr);
    if (!targetOrder || !partner?.id) return;

    setLoading(true);
    try {
      const response = await fetch(CONFIG.ENDPOINTS.ACCEPT_DELIVERY_JOB, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({
          partner_id: partner.id,
          job_id: targetOrder.dbId
        })
      });
      const data = await response.json();
      if (data.success) {
        showToast('Order accepted successfully!');
        await fetchJobs(false);
      } else {
        Alert.alert('Error', data.message || 'Failed to accept order.');
      }
    } catch (error) {
      console.error('Error accepting job:', error);
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setLoading(false);
      setConfirmModalVisible(false);
      setOrderToAccept(null);
    }
  };



  // Custom date range states (defaults to 1 month range relative to today)
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);

  // Calendar Picker state
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const prevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const nextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  // 1. Period & Search filtering
  const periodFilteredOrders = orders.filter((order) => {
    // Active orders (NEW or ACCEPTED) bypass period filtering so they are always visible to the driver!
    if (order.status !== 'NEW' && order.status !== 'ACCEPTED') {
      // Period filter
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'today' && order.period !== 'today') return false;
      if (selectedFilter === 'week' && order.period !== 'today' && order.period !== 'week') return false;
      if (selectedFilter === 'month' && order.period !== 'today' && order.period !== 'week' && order.period !== 'month') return false;
      if (selectedFilter === 'custom') {
        const orderDate = new Date(order.date);
        const startLimit = new Date(customStartDate);
        const endLimit = new Date(customEndDate);
        orderDate.setHours(0, 0, 0, 0);
        startLimit.setHours(0, 0, 0, 0);
        endLimit.setHours(0, 0, 0, 0);
        if (orderDate < startLimit || orderDate > endLimit) return false;
      }
    }

    // Search query filter
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      const matchId = order.id.toLowerCase().includes(query);
      const matchStore = order.pickupStore.toLowerCase().includes(query);
      const matchLocation = order.deliveryLocation.toLowerCase().includes(query);
      return matchId || matchStore || matchLocation;
    }

    return true;
  });

  // Dynamic counts for status cards based on current period and search query
  const newCount = periodFilteredOrders.filter((o) => o.status === 'NEW').length;
  const acceptedCount = periodFilteredOrders.filter((o) => o.status === 'ACCEPTED').length;
  const deliveredCount = periodFilteredOrders.filter((o) => o.status === 'DELIVERED').length;

  // 2. Status filtering to get final orders list
  const filteredOrders = periodFilteredOrders.filter((order) => {
    if (statusFilter !== 'ALL') {
      return order.status === statusFilter;
    }
    return true;
  });

  // Sort orders when statusFilter is 'ALL'
  // Priority: ACCEPTED (1) -> NEW/PENDING (2) -> DELIVERED (3) -> CANCELLED (4)
  if (statusFilter === 'ALL') {
    const statusPriority: Record<string, number> = {
      'ACCEPTED': 1,
      'NEW': 2,
      'PENDING': 2,
      'DELIVERED': 3,
      'CANCELLED': 4
    };
    filteredOrders.sort((a, b) => {
      const priorityA = statusPriority[a.status] ?? 99;
      const priorityB = statusPriority[b.status] ?? 99;
      return priorityA - priorityB;
    });
  }

  // 3. Filter activities based on current period selection
  const filteredActivities = activities.filter((act) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'today' && act.period !== 'today') return false;
    if (selectedFilter === 'week' && act.period !== 'today' && act.period !== 'week') return false;
    if (selectedFilter === 'month' && act.period !== 'today' && act.period !== 'week' && act.period !== 'month') return false;
    if (selectedFilter === 'custom') {
      const actDate = new Date(act.date);
      const startLimit = new Date(customStartDate);
      const endLimit = new Date(customEndDate);
      actDate.setHours(0, 0, 0, 0);
      startLimit.setHours(0, 0, 0, 0);
      endLimit.setHours(0, 0, 0, 0);
      if (actDate < startLimit || actDate > endLimit) return false;
    }
    return true;
  });

  // Calculate dynamic stats
  const earningsSum = periodFilteredOrders
    .filter((order) => order.status === 'DELIVERED')
    .reduce((sum, order) => {
      const numericVal = parseFloat(order.value.replace('₹', ''));
      return sum + numericVal;
    }, 0);

  const completedTripsCount = periodFilteredOrders.filter((order) => order.status === 'DELIVERED').length;

  const insets = useSafeAreaInsets();

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'DELIVERED':
        return { text: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
      case 'CANCELLED':
        return { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
      case 'NEW':
        return { text: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' };
      case 'ACCEPTED':
        return { text: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' };
      case 'PENDING':
      default:
        return { text: '#8b8fa3', bg: 'rgba(139, 143, 163, 0.15)' };
    }
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* TopAppBar Header */}
      <View style={[styles.topAppBar, { backgroundColor: colors.background }]}>
        <View style={styles.headerContainer}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={15}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 19l-7-7 7-7"
                stroke={colors.accent}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.accent }]}>Orders History</Text>
          <Pressable onPress={() => setFilterDropdownVisible(true)} style={styles.headerFilterBtn} hitSlop={15}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 4h16v2L14 12v6l-4 2v-8L4 6V4z"
                stroke={colors.accent}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => fetchJobs(false)} 
            colors={[colors.accent]} 
            tintColor={colors.accent} 
          />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <>
            {/* Search Bar */}
        <View style={styles.searchSection}>
          <CustomInput
            placeholder="Search Order ID, Store, or Location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={{ height: 46 }}
          />
        </View>

        {/* Date Selector Banner for Custom Filter */}
        {selectedFilter === 'custom' && (
          <View style={[styles.dateRangeContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable
              onPress={() => setActivePicker('start')}
              style={[styles.dateInputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
            >
              <Text style={[styles.dateInputLabel, { color: colors.textSecondary }]}>From</Text>
              <Text style={[styles.dateInputValue, { color: colors.textPrimary }]}>
                {formatDateDisplay(customStartDate)}
              </Text>
            </Pressable>

            <View style={styles.dateRangeArrow}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M5 12h14M12 5l7 7-7 7" stroke={colors.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>

            <Pressable
              onPress={() => setActivePicker('end')}
              style={[styles.dateInputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
            >
              <Text style={[styles.dateInputLabel, { color: colors.textSecondary }]}>To</Text>
              <Text style={[styles.dateInputValue, { color: colors.textPrimary }]}>
                {formatDateDisplay(customEndDate)}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Period Earnings & Completed trips summary bar */}
        <View style={styles.earningsSummaryBar}>
          <Text style={[styles.earningsSummaryText, { color: colors.textSecondary }]}>
            Period Earnings: <Text style={{ fontFamily: 'Inter-Bold', color: colors.accent }}>₹{earningsSum.toFixed(2)}</Text>
          </Text>
          <View style={[styles.bulletSeparator, { backgroundColor: colors.border }]} />
          <Text style={[styles.earningsSummaryText, { color: colors.textSecondary }]}>
            Completed: <Text style={{ fontFamily: 'Inter-Bold', color: colors.textPrimary }}>{completedTripsCount}</Text>
          </Text>
        </View>

        {/* Status Count Cards (New Order, Accepted, Delivered) */}
        <View style={styles.statusCardsGrid}>
          {/* New Orders Card */}
          <Pressable
            onPress={() => setStatusFilter(statusFilter === 'NEW' ? 'ALL' : 'NEW')}
            style={({ pressed }) => [
              styles.statusCard,
              {
                borderColor: statusFilter === 'NEW' ? '#f97316' : colors.border,
                backgroundColor: statusFilter === 'NEW' ? getSelectedCardBg('NEW') : colors.card,
                opacity: pressed ? 0.9 : 1,
              }
            ]}
          >
            <View style={[styles.statusIconBg, { backgroundColor: 'rgba(249, 115, 22, 0.1)' }]}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
              </Svg>
            </View>
            <Text style={[styles.statusCardValue, { color: colors.textPrimary }]}>{newCount}</Text>
            <Text style={[styles.statusCardLabel, { color: colors.textSecondary }]}>New Orders</Text>
          </Pressable>

          {/* Accepted Card */}
          <Pressable
            onPress={() => setStatusFilter(statusFilter === 'ACCEPTED' ? 'ALL' : 'ACCEPTED')}
            style={({ pressed }) => [
              styles.statusCard,
              {
                borderColor: statusFilter === 'ACCEPTED' ? '#3b82f6' : colors.border,
                backgroundColor: statusFilter === 'ACCEPTED' ? getSelectedCardBg('ACCEPTED') : colors.card,
                opacity: pressed ? 0.9 : 1,
              }
            ]}
          >
            <View style={[styles.statusIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M20 6L9 17l-5-5" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={[styles.statusCardValue, { color: colors.textPrimary }]}>{acceptedCount}</Text>
            <Text style={[styles.statusCardLabel, { color: colors.textSecondary }]}>Accepted</Text>
          </Pressable>

          {/* Delivered Card */}
          <Pressable
            onPress={() => setStatusFilter(statusFilter === 'DELIVERED' ? 'ALL' : 'DELIVERED')}
            style={({ pressed }) => [
              styles.statusCard,
              {
                borderColor: statusFilter === 'DELIVERED' ? '#10b981' : colors.border,
                backgroundColor: statusFilter === 'DELIVERED' ? getSelectedCardBg('DELIVERED') : colors.card,
                opacity: pressed ? 0.9 : 1,
              }
            ]}
          >
            <View style={[styles.statusIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M22 4L12 14.01l-3-3" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={[styles.statusCardValue, { color: colors.textPrimary }]}>{deliveredCount}</Text>
            <Text style={[styles.statusCardLabel, { color: colors.textSecondary }]}>Delivered</Text>
          </Pressable>
        </View>

        {/* Tab Selector */}
        <View style={[styles.tabContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Pressable
            onPress={() => setActiveTab('orders')}
            style={[styles.tabBtn, activeTab === 'orders' && { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === 'orders' ? '#ffffff' : colors.textSecondary }]}>
              Orders ({filteredOrders.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('activity')}
            style={[styles.tabBtn, activeTab === 'activity' && { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === 'activity' ? '#ffffff' : colors.textSecondary }]}>
              Recent Activity ({filteredActivities.length})
            </Text>
          </Pressable>
        </View>

        {activeTab === 'activity' ? (
          /* Recent Activity / Timeline Tab */
          filteredActivities.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" style={styles.emptyIcon}>
                <Circle cx="12" cy="12" r="10" stroke={colors.textMuted} strokeWidth="2" />
                <Path d="M12 8v4M12 16h.01" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" />
              </Svg>
              <Text style={[styles.emptyText, { color: colors.textPrimary }]}>No activity found</Text>
              <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                There is no recorded activity for this selected period.
              </Text>
            </View>
          ) : (
            <View style={[styles.timelineContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {filteredActivities.map((activity, index) => {
                const isLast = index === filteredActivities.length - 1;
                let typeColor = '#3b82f6';
                if (activity.type === 'DELIVERED') typeColor = '#10b981';
                else if (activity.type === 'CANCELLED') typeColor = '#ef4444';
                else if (activity.type === 'RECEIVED') typeColor = '#f97316';

                return (
                  <View key={activity.id} style={styles.timelineRow}>
                    <View style={styles.timelineVisual}>
                      <View style={[styles.timelineDot, { backgroundColor: typeColor }]} />
                      {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineMessage, { color: colors.textPrimary }]}>
                        {activity.message}
                      </Text>
                      <Text style={[styles.timelineTime, { color: colors.textSecondary }]}>
                        {activity.timestamp}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )
        ) : (
          /* Orders Tab */
          <View>
            {/* Status Filter Chips Row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusChipsScroll}
              style={styles.statusChipsContainer}
            >
              {(['ALL', 'NEW', 'ACCEPTED', 'DELIVERED'] as const).map((status) => {
                const isActive = statusFilter === status;
                const label = status === 'ALL' ? 'All Orders' : status === 'NEW' ? 'New Orders' : status === 'ACCEPTED' ? 'Accepted' : 'Delivered';
                return (
                  <Pressable
                    key={status}
                    onPress={() => setStatusFilter(status)}
                    style={[
                      styles.statusChipBtn,
                      isActive
                        ? { backgroundColor: colors.accent, borderColor: colors.accent }
                        : { backgroundColor: colors.inputBg, borderColor: colors.border }
                    ]}
                  >
                    <Text style={[
                      styles.statusChipText,
                      { color: isActive ? '#ffffff' : colors.textSecondary }
                    ]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {filteredOrders.length === 0 ? (
              /* Empty State */
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" style={styles.emptyIcon}>
                  <Circle cx="12" cy="12" r="10" stroke={colors.textMuted} strokeWidth="2" />
                  <Path d="M12 8v4M12 16h.01" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" />
                </Svg>
                <Text style={[styles.emptyText, { color: colors.textPrimary }]}>No orders found</Text>
                <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                  Try adjusting your filters or search query terms.
                </Text>
              </View>
            ) : (
              /* Orders list cards */
              filteredOrders.map((order) => {
                const badgeColors = getStatusColor(order.status);
                return (
                  <Pressable
                    key={order.id}
                    onPress={() => {
                      if (order.status === 'ACCEPTED') {
                        router.push({
                          pathname: '/order_details',
                          params: { 
                            orderId: order.id, 
                            jobId: order.dbId,
                            deliveryAddress: order.deliveryLocation,
                            userPhone: order.userPhone || ''
                          }
                        });
                      }
                    }}
                    style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    {/* Header row */}
                    <View style={styles.orderCardHeader}>
                      <View style={styles.orderCardHeaderLeft}>
                        <Text style={[styles.orderId, { color: colors.textPrimary }]}>{order.id}</Text>
                        <View style={[
                          styles.methodBadge,
                          { backgroundColor: order.paymentMethod === 'ONLINE' ? 'rgba(0, 108, 73, 0.1)' : 'rgba(59, 130, 246, 0.1)' }
                        ]}>
                          <Text style={[
                            styles.methodText,
                            { color: order.paymentMethod === 'ONLINE' ? colors.accent : '#3b82f6' }
                          ]}>
                            {order.paymentMethod}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.orderCardHeaderRight}>
                        <Text style={[styles.estEarningLabel, { color: colors.textSecondary }]}>Est. Earning</Text>
                        <Text style={[styles.orderValue, { color: '#10b981' }]}>{order.value}</Text>
                      </View>
                    </View>

                    <Text style={[styles.orderTime, { color: colors.textSecondary }]}>{order.timestamp}</Text>

                    {/* Transit connector path */}
                    <View style={styles.transitContainer}>
                      {/* Vertical Line Connector */}
                      <View style={[styles.verticalConnector, { backgroundColor: colors.border }]} />

                      {/* Pickup details */}
                      <View style={styles.transitRow}>
                        <View style={[styles.connectorDot, { backgroundColor: colors.textSecondary }]} />
                        <View style={styles.transitDetails}>
                          <Text style={[styles.transitLabel, { color: colors.textSecondary }]}>PICKUP</Text>
                          <Text style={[styles.transitAddr, { color: colors.textPrimary }]}>
                            {order.pickupStore} • {order.pickupLocation}
                          </Text>
                        </View>
                      </View>

                      {/* Delivery details */}
                      <View style={[styles.transitRow, { marginTop: 12 }]}>
                        <View style={[styles.connectorDot, { backgroundColor: colors.accent }]} />
                        <View style={styles.transitDetails}>
                          <Text style={[styles.transitLabel, { color: colors.textSecondary }]}>DELIVERY</Text>
                          {(() => {
                            const parsedAddr = formatAddress(order.deliveryLocation);
                            return (
                              <View>
                                {parsedAddr.firstLine ? (
                                  <Text style={[styles.transitAddr, { color: colors.textPrimary }]}>
                                    {parsedAddr.firstLine}
                                  </Text>
                                ) : null}
                                {parsedAddr.secondLine ? (
                                  <Text style={[styles.transitAddr, { color: colors.textPrimary, marginTop: 2 }]}>
                                    {parsedAddr.secondLine}
                                  </Text>
                                ) : null}
                                {parsedAddr.thirdLine ? (
                                  <Text style={[styles.transitAddr, { color: colors.accent, fontFamily: 'Inter-SemiBold', marginTop: 2 }]}>
                                    {parsedAddr.thirdLine}
                                  </Text>
                                ) : null}
                              </View>
                            );
                          })()}
                        </View>
                      </View>
                    </View>

                    {/* Card Footer Status */}
                    <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

                    <View style={styles.cardFooter}>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: badgeColors.bg }
                      ]}>
                        <View style={[
                          styles.statusIndicatorDot,
                          { backgroundColor: badgeColors.text }
                        ]} />
                        <Text style={[
                          styles.statusText,
                          { color: badgeColors.text }
                        ]}>
                          {order.status}
                        </Text>
                      </View>

                      {/* Mini Chevron pointing to details (shown only for ACCEPTED orders) */}
                      {order.status === 'ACCEPTED' ? (
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                          <Path d="M9 5l7 7-7 7" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      ) : (
                        <View style={{ width: 16 }} />
                      )}
                    </View>

                    {/* Accept Order Swipe Button for NEW status */}
                    {order.status === 'NEW' && (
                      <View style={styles.acceptBtnContainer}>
                        <View style={[styles.cardDivider, { backgroundColor: colors.border, marginBottom: 12 }]} />
                        <SwipeButton
                          text="Swipe to Accept Order"
                          color="#3b82f6"
                          onSwipeSuccess={() => handleAcceptOrder(order.id)}
                        />
                      </View>
                    )}
                  </Pressable>
                );
              })
            )}
          </View>
        )}

          </>
        )}
        <View style={[styles.bottomBarSpacer, { height: 75 + insets.bottom }]} />
      </ScrollView>

      <BottomTabBar activeTab="orders" />

      {/* Custom Toast Message at Bottom Center */}
      {toastMessage && (
        <Animated.View style={[styles.toastContainer, { opacity: toastOpacity, bottom: insets.bottom + 82 }]}>
          <View style={[styles.toastContent, { backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)', borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)' }]}>
            <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
              <Path d="M10 0C4.48 0 0 4.48 0 10s4.48 10 10 10 10-4.48 10-10S15.52 0 10 0zm-2 15l-5-5 1.41-1.41L8 12.17l7.59-7.59L17 6l-9 9z" fill="#10b981" />
            </Svg>
            <Text style={[styles.toastText, { color: isDarkMode ? '#ffffff' : '#1e293b' }]}>
              {toastMessage}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Header Period Filter Dropdown Modal */}
      <Modal
        visible={filterDropdownVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFilterDropdownVisible(false)}
      >
        <Pressable
          style={styles.dropdownOverlay}
          onPress={() => setFilterDropdownVisible(false)}
        >
          <View style={[styles.dropdownMenu, { top: 56 + insets.top, backgroundColor: colors.card, borderColor: colors.border }]}>
            {(['all', 'today', 'week', 'month', 'custom'] as const).map((item) => {
              const isActive = selectedFilter === item;
              const label = item === 'all' ? 'All Orders' : item === 'today' ? 'Today' : item === 'week' ? 'This Week' : item === 'month' ? 'This Month' : 'Custom Range';
              return (
                <Pressable
                  key={item}
                  style={[
                    styles.dropdownItem,
                    isActive && { backgroundColor: colors.accentLight }
                  ]}
                  onPress={() => {
                    setSelectedFilter(item);
                    setFilterDropdownVisible(false);
                    if (item === 'custom') {
                      const today = new Date();
                      const oneMonthAgo = new Date();
                      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                      setCustomStartDate(oneMonthAgo.toISOString().split('T')[0]);
                      setCustomEndDate(today.toISOString().split('T')[0]);
                      setCalendarMonth(today.getMonth());
                      setCalendarYear(today.getFullYear());
                    }
                  }}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    { color: isActive ? colors.accent : colors.textPrimary },
                    isActive && { fontFamily: 'Inter-SemiBold' }
                  ]}>
                    {label}
                  </Text>
                  {isActive && (
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M20 6L9 17l-5-5" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Premium Accept Order Confirmation Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setConfirmModalVisible(false);
          setOrderToAccept(null);
        }}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={[styles.confirmModalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Alert Icon wrapper */}
            <View style={[styles.confirmIconBg, { backgroundColor: 'rgba(249, 115, 22, 0.1)' }]}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke="#f97316" strokeWidth="2.5" />
                <Path d="M12 8v4M12 16h.01" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
              </Svg>
            </View>

            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>Accept Order</Text>
            <Text style={[styles.confirmSubtitle, { color: colors.textSecondary }]}>
              Are you sure you want to accept order <Text style={{ fontFamily: 'Inter-Bold', color: colors.accent }}>{orderToAccept}</Text>? This action will assign the order to you.
            </Text>

            <View style={[styles.cardDivider, { backgroundColor: colors.border, width: '100%', marginVertical: 20 }]} />

            <View style={styles.confirmButtonsRow}>
              <Pressable
                onPress={() => {
                  setConfirmModalVisible(false);
                  setOrderToAccept(null);
                }}
                style={[styles.confirmBtn, styles.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={confirmAcceptOrder}
                style={[styles.confirmBtn, styles.acceptBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.acceptBtnText}>Accept</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal
        visible={activePicker !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>

            {/* Calendar Month Selector Header */}
            <View style={styles.calendarHeader}>
              <Pressable onPress={prevMonth} style={[styles.navBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} hitSlop={10}>
                <Text style={[styles.navBtnText, { color: colors.textPrimary }]}>&lt;</Text>
              </Pressable>
              <Text style={[styles.calendarMonthTitle, { color: colors.textPrimary }]}>
                {MONTHS[calendarMonth]} {calendarYear}
              </Text>
              <Pressable onPress={nextMonth} style={[styles.navBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} hitSlop={10}>
                <Text style={[styles.navBtnText, { color: colors.textPrimary }]}>&gt;</Text>
              </Pressable>
            </View>

            {/* Weekdays indicator row */}
            <View style={styles.weekdaysRow}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={[styles.weekdayCell, { color: colors.textSecondary }]}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid */}
            <ScrollView contentContainerStyle={styles.calendarGrid} showsVerticalScrollIndicator={false}>
              {/* Render empty spacer views for start day index */}
              {Array.from({ length: getFirstDayOfMonth(calendarMonth, calendarYear) }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.emptyDayCell} />
              ))}

              {/* Render active days */}
              {Array.from({ length: getDaysInMonth(calendarMonth, calendarYear) }).map((_, i) => {
                const dayNum = i + 1;
                const formattedMonth = String(calendarMonth + 1).padStart(2, '0');
                const formattedDay = String(dayNum).padStart(2, '0');
                const dateStr = `${calendarYear}-${formattedMonth}-${formattedDay}`;

                const isSelected = activePicker === 'start' ? customStartDate === dateStr : customEndDate === dateStr;

                return (
                  <Pressable
                    key={dateStr}
                    onPress={() => {
                      if (activePicker === 'start') {
                        setCustomStartDate(dateStr);
                      } else {
                        setCustomEndDate(dateStr);
                      }
                      setActivePicker(null);
                    }}
                    style={[
                      styles.calendarDayCell,
                      isSelected && { backgroundColor: colors.accent, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={[
                      styles.calendarDayText,
                      { color: colors.textPrimary },
                      isSelected && { color: '#ffffff', fontFamily: 'Inter-Bold' }
                    ]}>
                      {dayNum}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <CustomButton
              title="Cancel"
              onPress={() => setActivePicker(null)}
              style={[styles.modalCloseBtn, { backgroundColor: colors.accentLight }]}
              textStyle={{ color: colors.accent }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topAppBar: {
    height: 56,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.1)',
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 4,
    marginLeft: -4,
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
    padding: 16,
    paddingBottom: 96,
  },
  searchSection: {
    marginBottom: 16,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  filterChipBtn: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    elevation: 0,
  },
  filterChipBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  gridCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridIconBg: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTrend: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  gridLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    marginBottom: 4,
  },
  gridAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    letterSpacing: -0.5,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
  },
  downloadBtn: {
    backgroundColor: 'transparent',
    height: 'auto',
    width: 'auto',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  downloadBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
  },
  emptyIcon: {
    marginBottom: 12,
    opacity: 0.6,
  },
  emptyText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    marginBottom: 4,
  },
  emptySubText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  orderCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderId: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  methodBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  methodText: {
    fontFamily: 'Inter-Bold',
    fontSize: 9,
  },
  orderCardHeaderRight: {
    alignItems: 'flex-end',
  },
  orderValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  orderTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    marginBottom: 16,
  },
  transitContainer: {
    paddingLeft: 12,
    position: 'relative',
    marginBottom: 16,
  },
  verticalConnector: {
    position: 'absolute',
    left: 17,
    top: 14,
    width: 1,
    height: 32,
  },
  transitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  connectorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 1,
    marginTop: 4,
  },
  transitDetails: {
    flex: 1,
  },
  transitLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  transitAddr: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    flexWrap: 'wrap',
  },
  cardDivider: {
    height: 1,
    opacity: 0.3,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
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
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  dateInputBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  dateInputLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  dateInputValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  dateRangeArrow: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '92%',
    maxHeight: '75%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 18,
  },
  calendarMonthTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
  },
  weekdaysRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingBottom: 8,
  },
  weekdayCell: {
    width: '14.28%',
    textAlign: 'center',
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    rowGap: 8,
  },
  emptyDayCell: {
    width: '14.28%',
    aspectRatio: 1.1,
  },
  calendarDayCell: {
    width: '14.28%',
    aspectRatio: 1.1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
  calendarDayText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
  modalCloseBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    marginTop: 16,
    shadowOpacity: 0,
    elevation: 0,
  },
  headerFilterBtn: {
    padding: 6,
    marginRight: -6,
  },
  earningsSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  earningsSummaryText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  bulletSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 12,
    opacity: 0.5,
  },
  statusCardsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statusCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any,
    }),
  },
  statusIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statusCardValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    marginBottom: 2,
  },
  statusCardLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any,
    }),
  },
  tabBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  statusChipsContainer: {
    marginBottom: 16,
  },
  statusChipsScroll: {
    gap: 8,
    paddingRight: 16,
  },
  statusChipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
      } as any,
    }),
  },
  statusChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  timelineContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 64,
  },
  timelineVisual: {
    alignItems: 'center',
    width: 24,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  timelineMessage: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 18,
  },
  timelineTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  dropdownMenu: {
    position: 'absolute',
    right: 16,
    width: 180,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  estEarningLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    textAlign: 'right',
    marginBottom: 2,
  },
  acceptBtnContainer: {
    marginTop: 4,
  },
  acceptOrderBtn: {
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  acceptOrderBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
    color: '#ffffff',
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmModalContent: {
    width: '90%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  confirmIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  confirmButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1.5,
  },
  acceptBtn: {
    elevation: 0,
  },
  cancelBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  acceptBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: '#ffffff',
  },
  loadingContainer: {
    paddingVertical: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
      } as any,
    }),
  },
  toastText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
