import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, ScrollView, Platform, RefreshControl, Modal, TextInput, ActivityIndicator, Animated, Dimensions } from 'react-native';
import { CustomAlert as Alert } from '../components/CustomAlert';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import CustomButton from '../components/CustomButton';
import { useTheme } from '../context/ThemeContext';
import BottomTabBar from '../components/BottomTabBar';
import { useAuth } from '../context/AuthContext';
import CONFIG from '../connection/config';
import { EarningsTransactionsModal } from '../components/EarningsTransactionsModal';

// Dynamic mock data based on period
interface PeriodData {
  earnings: string;
  completed: string;
  online: string;
  cod: string;
  trend: string;
  graphData: { label: string; value: number; active?: boolean }[];
  incentiveCurrent: number;
  incentiveTarget: number;
  incentiveLabel: string;
  bonusCurrent: number;
  bonusTarget: number;
  bonusLabel: string;
  basePay: string;
  surgePay: string;
  tips: string;
  totalBreakdown: string;
  recentActivity: {
    id: string;
    title: string;
    date: string;
    amount: string;
    status: 'COMPLETED' | 'PROCESSING';
  }[];
}

const mockData: Record<string, PeriodData> = {
  today: {
    earnings: '₹850',
    completed: '12 Deliveries Completed',
    online: '₹450',
    cod: '₹400',
    trend: '+12%',
    graphData: [
      { label: 'Mon', value: 58 },
      { label: 'Tue', value: 38 },
      { label: 'Wed', value: 82 },
      { label: 'Thu', value: 96, active: true },
      { label: 'Fri', value: 53 },
      { label: 'Sat', value: 67 },
      { label: 'Sun', value: 29 },
    ],
    incentiveCurrent: 50,
    incentiveTarget: 100,
    incentiveLabel: 'Complete 3 more orders to reach next goal.',
    bonusCurrent: 320,
    bonusTarget: 500,
    bonusLabel: 'On track! Keep going to unlock ₹500 bonus.',
    basePay: '₹620.00',
    surgePay: '₹145.00',
    tips: '₹85.00',
    totalBreakdown: '₹850.00',
    recentActivity: [
      { id: '1', title: 'Withdrawal to Bank', date: 'Today, 10:15 AM', amount: '-₹500', status: 'PROCESSING' },
      { id: '2', title: 'Withdrawal to Bank', date: 'Yesterday, 6:30 PM', amount: '-₹1,200', status: 'COMPLETED' },
    ],
  },
  weekly: {
    earnings: '₹5,820',
    completed: '74 Deliveries Completed',
    online: '₹3,420',
    cod: '₹2,400',
    trend: '+8%',
    graphData: [
      { label: 'Mon', value: 75 },
      { label: 'Tue', value: 60 },
      { label: 'Wed', value: 85 },
      { label: 'Thu', value: 90 },
      { label: 'Fri', value: 80 },
      { label: 'Sat', value: 95, active: true },
      { label: 'Sun', value: 70 },
    ],
    incentiveCurrent: 350,
    incentiveTarget: 500,
    incentiveLabel: 'On track! Keep going to unlock weekly bonuses.',
    bonusCurrent: 800,
    bonusTarget: 1000,
    bonusLabel: 'Complete 10 more orders to secure next loyalty bonus.',
    basePay: '₹4,200.00',
    surgePay: '₹940.00',
    tips: '₹680.00',
    totalBreakdown: '₹5,820.00',
    recentActivity: [
      { id: '3', title: 'Weekly Payout', date: 'Oct 23, 2:30 PM', amount: '-₹4,800', status: 'COMPLETED' },
      { id: '4', title: 'Withdrawal to Bank', date: 'Oct 20, 11:15 AM', amount: '-₹1,000', status: 'COMPLETED' },
    ],
  },
  monthly: {
    earnings: '₹24,650',
    completed: '312 Deliveries Completed',
    online: '₹15,200',
    cod: '₹9,450',
    trend: '+15%',
    graphData: [
      { label: 'W1', value: 80 },
      { label: 'W2', value: 95, active: true },
      { label: 'W3', value: 70 },
      { label: 'W4', value: 88 },
    ],
    incentiveCurrent: 2500,
    incentiveTarget: 3000,
    incentiveLabel: 'Complete 15 more orders for monthly loyalty rewards.',
    bonusCurrent: 2000,
    bonusTarget: 2500,
    bonusLabel: 'Unlocked milestone tier! Premium bonus pending verification.',
    basePay: '₹18,500.00',
    surgePay: '₹3,850.00',
    tips: '₹2,300.00',
    totalBreakdown: '₹24,650.00',
    recentActivity: [
      { id: '5', title: 'Monthly Bonus', date: 'Sep 30, 5:00 PM', amount: '-₹20,000', status: 'COMPLETED' },
      { id: '6', title: 'Withdrawal to Bank', date: 'Sep 15, 9:00 AM', amount: '-₹4,000', status: 'COMPLETED' },
    ],
  },
  total: {
    earnings: '₹1,12,850',
    completed: '1,424 Deliveries Completed',
    online: '₹72,400',
    cod: '₹40,450',
    trend: '+22%',
    graphData: [
      { label: 'Q1', value: 70 },
      { label: 'Q2', value: 85 },
      { label: 'Q3', value: 90 },
      { label: 'Q4', value: 95, active: true },
    ],
    incentiveCurrent: 8000,
    incentiveTarget: 10000,
    incentiveLabel: 'Unlocked premium fleet member status.',
    bonusCurrent: 5000,
    bonusTarget: 5000,
    bonusLabel: 'All milestone loyalty bonuses unlocked.',
    basePay: '₹84,200.00',
    surgePay: '₹17,850.00',
    tips: '₹10,800.00',
    totalBreakdown: '₹1,12,850.00',
    recentActivity: [
      { id: '7', title: 'Withdrawal to Bank', date: 'Aug 31, 2:30 PM', amount: '-₹22,000', status: 'COMPLETED' },
      { id: '8', title: 'Withdrawal to Bank', date: 'Jul 31, 1:15 PM', amount: '-₹20,000', status: 'COMPLETED' },
    ],
  },
};

export default function EarningsScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const { partner, updatePartnerState } = useAuth();

  // Selected period inside earnings context ('today', 'weekly', 'monthly', 'total')
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'weekly' | 'monthly' | 'total'>('today');

  const activeData = mockData[selectedPeriod];

  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [earningsData, setEarningsData] = useState<any>({
    total_earnings: '0.00',
    cash_in_hand: '0.00',
    total_earnings_history: '0.00',
    online_order_amount: '0.00',
    cod_amount_collected: '0.00',
    total_withdrawals: '0.00',
    total_deposits: '0.00',
    total_delivered_order_amount: '0.00',
    weekly_trend: [],
    recent_activity: [],
    withdrawals_list: [],
    deposits_list: []
  });

  const [isWithdrawModalVisible, setIsWithdrawModalVisible] = useState(false);
  const [isDepositModalVisible, setIsDepositModalVisible] = useState(false);
  const [isEarningsTransactionsModalVisible, setIsEarningsTransactionsModalVisible] = useState(false);
  const [isRequestListModalVisible, setIsRequestListModalVisible] = useState(false);
  const [shouldRenderSettlement, setShouldRenderSettlement] = useState(false);
  const settlementSlideAnim = useRef(new Animated.Value(Dimensions.get('window').width)).current;

  // Slide Animation Controller for Settlement Modal (Right Side)
  useEffect(() => {
    if (isRequestListModalVisible) {
      setShouldRenderSettlement(true);
      Animated.timing(settlementSlideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(settlementSlideAnim, {
        toValue: Dimensions.get('window').width,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setShouldRenderSettlement(false);
      });
    }
  }, [isRequestListModalVisible]);

  const [activeRequestListTab, setActiveRequestListTab] = useState<'all' | 'withdraw' | 'deposit'>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isTransactionDetailsModalVisible, setIsTransactionDetailsModalVisible] = useState(false);
  const [isActivityHistoryModalVisible, setIsActivityHistoryModalVisible] = useState(false);
  const [activityPeriodFilter, setActivityPeriodFilter] = useState<'today' | 'week'>('week');
  const [inputAmount, setInputAmount] = useState('');
  const [inputRemarks, setInputRemarks] = useState('');

  // Live withdrawable earnings & deposit limits
  const availableWithdrawBalance = Math.max(
    0,
    parseFloat(earningsData.balance ?? earningsData.total_earnings ?? partner?.total_earnings ?? '0')
  );
  const pendingWithdrawAmount = parseFloat(earningsData.pending_withdrawals ?? '0');

  const totalCashInHand = parseFloat(
    earningsData.cash_in_hand ?? partner?.cash_in_hand ?? '0'
  );
  const pendingDepositAmount = parseFloat(earningsData.pending_deposits ?? '0');
  const availableCashToDeposit = Math.max(
    0,
    parseFloat(earningsData.available_cash_in_hand ?? (totalCashInHand - pendingDepositAmount).toFixed(2))
  );

  const withdrawNum = parseFloat(inputAmount);
  const isWithdrawExceeded = !isNaN(withdrawNum) && withdrawNum > availableWithdrawBalance;
  const isWithdrawValid = !isNaN(withdrawNum) && withdrawNum > 0 && !isWithdrawExceeded;

  const depositNum = parseFloat(inputAmount);
  const isDepositExceeded = !isNaN(depositNum) && depositNum > availableCashToDeposit;
  const isDepositValid = !isNaN(depositNum) && depositNum > 0 && !isDepositExceeded;

  const maxWeeklyAmount = Math.max(...(earningsData.weekly_trend || []).map((d: any) => parseFloat(d.amount)), 1);

  const parseBankSnapshot = (snapshot: any) => {
    if (!snapshot) return null;
    if (typeof snapshot === 'object') return snapshot;
    try {
      return JSON.parse(snapshot);
    } catch {
      return null;
    }
  };

  const getFilteredTransactions = () => {
    const withdrawals = (earningsData.withdrawals_list || []).map((w: any) => ({
      ...w,
      settlement_type: 'withdrawal',
      type_category: 'withdrawal'
    }));
    const deposits = (earningsData.deposits_list || []).map((d: any) => ({
      ...d,
      settlement_type: 'deposit',
      type_category: 'deposit'
    }));

    if (activeRequestListTab === 'withdraw') {
      return withdrawals;
    }
    if (activeRequestListTab === 'deposit') {
      return deposits;
    }
    const combined = [...withdrawals, ...deposits];
    combined.sort((a, b) => {
      const idA = parseInt(a.id || '0', 10);
      const idB = parseInt(b.id || '0', 10);
      return idB - idA;
    });
    return combined;
  };

  const getFilteredActivities = () => {
    if (!earningsData.recent_activity) return [];
    
    const todayDate = new Date();
    const todayStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(todayDate.getDate() - 7);
    const weekStart = new Date(oneWeekAgo.getFullYear(), oneWeekAgo.getMonth(), oneWeekAgo.getDate());

    return earningsData.recent_activity.filter((act: any) => {
      if (!act.raw_date) return true;
      const actTime = new Date(act.raw_date.replace(' ', 'T')).getTime();
      
      if (activityPeriodFilter === 'today') {
        return actTime >= todayStart.getTime();
      } else if (activityPeriodFilter === 'week') {
        return actTime >= weekStart.getTime();
      }
      return true;
    });
  };

  const fetchEarningsData = async (showLoadingIndicator = false) => {
    if (!partner?.id) return;
    if (showLoadingIndicator) setLoading(true);
    try {
      // 1. Refresh partner profile to get updated total_earnings and cash_in_hand
      const profileRes = await fetch(CONFIG.ENDPOINTS.PROFILE, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({ partner_id: partner.id }),
      });
      const profileData = await profileRes.json();
      if (profileRes.ok && profileData.success) {
        await updatePartnerState(profileData.user);
      }

      // 2. Fetch live earnings & ledger stats
      const response = await fetch(CONFIG.ENDPOINTS.EARNINGS, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({ partner_id: partner.id, period: selectedPeriod }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setEarningsData(data);
      } else {
        console.warn('Failed to fetch earnings stats:', data.message);
      }
    } catch (error) {
      console.error('Error fetching earnings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEarningsData(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchEarningsData(true);
  }, [partner?.id, selectedPeriod]);

  const handleWithdrawSubmit = async () => {
    const amt = parseFloat(inputAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than zero.');
      return;
    }
    if (amt > availableWithdrawBalance) {
      Alert.alert(
        'Insufficient Balance',
        `You cannot withdraw more than your available wallet balance of ₹${availableWithdrawBalance.toFixed(2)}.`
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(CONFIG.ENDPOINTS.WITHDRAW, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({
          partner_id: partner?.id,
          amount: amt,
          remarks: inputRemarks.trim()
        })
      });
      const data = await response.json();
      if (data.success) {
        const settlementNo = data.settlement_no ? `\nSettlement Ref: ${data.settlement_no}` : '';
        const target = data.target_role ? `\nSubmitted to: ${data.target_role}` : '';
        Alert.alert(
          'Withdrawal Request Submitted',
          `${data.message || 'Your withdrawal request has been submitted for approval.'}${settlementNo}${target}`
        );
        setIsWithdrawModalVisible(false);
        setInputAmount('');
        setInputRemarks('');
        await fetchEarningsData(false);
      } else {
        Alert.alert('Withdrawal Request Denied', data.message || 'Failed to complete withdrawal.');
      }
    } catch (error) {
      console.error('Withdrawal request failed:', error);
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDepositSubmit = async () => {
    const amt = parseFloat(inputAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than zero.');
      return;
    }
    if (amt > availableCashToDeposit) {
      const pendingNotice = pendingDepositAmount > 0 ? ` (₹${pendingDepositAmount.toFixed(2)} is already pending verification).` : '.';
      Alert.alert(
        'Invalid Deposit Amount',
        `You cannot deposit more than your available cash in hand of ₹${availableCashToDeposit.toFixed(2)}${pendingNotice}`
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(CONFIG.ENDPOINTS.DEPOSIT, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({
          partner_id: partner?.id,
          amount: amt,
          remarks: inputRemarks.trim()
        })
      });
      const data = await response.json();
      if (data.success) {
        const settlementNo = data.settlement_no ? `\nSettlement Ref: ${data.settlement_no}` : '';
        const target = data.target_role ? `\nTarget Authority: ${data.target_role}` : '';
        Alert.alert(
          'COD Deposit Submitted',
          `${data.message || 'Your cash deposit handover request has been recorded.'}${settlementNo}${target}`
        );
        setIsDepositModalVisible(false);
        setInputAmount('');
        setInputRemarks('');
        await fetchEarningsData(false);
      } else {
        Alert.alert('Deposit Request Denied', data.message || 'Failed to record deposit.');
      }
    } catch (error) {
      console.error('Deposit request failed:', error);
      Alert.alert('Error', 'Connection failed. Please try again.');
    } finally {
      setLoading(false);
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
          <Text style={[styles.headerTitle, { color: colors.accent }]}>Earnings</Text>
          <Pressable 
            onPress={() => {
              setActiveRequestListTab('all');
              setIsRequestListModalVisible(true);
            }} 
            style={[styles.backButton, { alignItems: 'flex-end', justifyContent: 'center' }]} 
            hitSlop={15}
            accessibilityLabel="View Settlements and Transactions"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                stroke={colors.accent}
                strokeWidth="2"
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
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.accent]} />
        }
      >
        {/* Period Selector Tabs */}
        <View style={styles.periodSelectorContainer}>
          {(['today', 'weekly', 'monthly', 'total'] as const).map((period) => {
            const isActive = selectedPeriod === period;
            return (
              <CustomButton
                key={period}
                title={period.charAt(0).toUpperCase() + period.slice(1)}
                onPress={() => setSelectedPeriod(period)}
                style={[
                  styles.periodBtn,
                  isActive
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
                textStyle={[
                  styles.periodBtnText,
                  isActive
                    ? { color: '#ffffff' }
                    : { color: colors.textSecondary },
                ]}
              />
            );
          })}
        </View>

        {/* Financial Balance Cards: Wallet and Cash in Hand side-by-side */}
        <View style={styles.cardRow}>
          {/* Wallet Balance Card */}
          <View style={[styles.gridFinanceCard, { backgroundColor: isDarkMode ? '#0d593d' : '#005136', borderColor: colors.border }]}>
            <View>
              <Text style={styles.financeCardLabel}>WALLET BALANCE</Text>
              <Text style={styles.financeCardAmount}>₹{availableWithdrawBalance.toFixed(2)}</Text>
              <Text style={styles.financeCardDesc}>
                {pendingWithdrawAmount > 0 ? `Withdrawable (₹${pendingWithdrawAmount.toFixed(0)} held)` : 'Withdrawable'}
              </Text>
            </View>
            <Pressable
              style={styles.financeCardAction}
              onPress={() => {
                setInputAmount('');
                setInputRemarks('');
                setIsWithdrawModalVisible(true);
              }}
            >
              <Text style={styles.financeCardActionText}>Withdraw</Text>
            </Pressable>
          </View>

          {/* Cash in Hand Card */}
          <View style={[styles.gridFinanceCard, { backgroundColor: isDarkMode ? '#1e293b' : '#334155', borderColor: colors.border }]}>
            <View>
              <Text style={styles.financeCardLabel}>CASH IN HAND</Text>
              <Text style={styles.financeCardAmount}>₹{totalCashInHand.toFixed(2)}</Text>
              <Text style={styles.financeCardDesc}>
                {pendingDepositAmount > 0 ? `Available: ₹${availableCashToDeposit.toFixed(0)} (₹${pendingDepositAmount.toFixed(0)} pending)` : 'Collected COD'}
              </Text>
            </View>
            <Pressable
              style={styles.financeCardActionSecondary}
              onPress={() => {
                setInputAmount('');
                setInputRemarks('');
                setIsDepositModalVisible(true);
              }}
            >
              <Text style={styles.financeCardActionTextSecondary}>Deposit Cash</Text>
            </Pressable>
          </View>
        </View>

        {/* Settlement History / Transactions Action Bar */}
        <View style={{
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 12,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: isDarkMode ? 0.2 : 0.05,
          shadowRadius: 3,
          elevation: 2,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 10 }}>
            <View style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: colors.accentLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  stroke={colors.accent}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter-Bold', fontSize: 13, color: colors.textPrimary }}>
                Settlement History
              </Text>
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                Withdrawals & Cash Deposits
              </Text>
            </View>
          </View>
          <Pressable
            style={{
              backgroundColor: colors.accent,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4
            }}
            onPress={() => {
              setActiveRequestListTab('all');
              setIsRequestListModalVisible(true);
            }}
          >
            <Text style={{ color: '#ffffff', fontFamily: 'Inter-SemiBold', fontSize: 12 }}>
              View Transactions
            </Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 5l7 7-7 7"
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </View>

        {/* Withdrawal & Deposit Totals side-by-side (same style as online/cod collection cards) */}
        <View style={styles.analyticsGrid}>
          {/* Total Withdrawals Card */}
          <Pressable 
            style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              setActiveRequestListTab('withdraw');
              setIsRequestListModalVisible(true);
            }}
          >
            <View style={styles.gridHeaderRow}>
              <View style={[styles.gridIconBg, { backgroundColor: colors.accentLight }]}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 5v14M19 12l-7 7-7-7"
                    stroke={colors.accent}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>Total Withdraw</Text>
            </View>
            <Text style={[styles.gridAmount, { color: colors.textPrimary }]}>₹{parseFloat(earningsData.total_withdrawals || '0').toFixed(2)}</Text>
          </Pressable>

          {/* Total Deposited Card */}
          <Pressable 
            style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              setActiveRequestListTab('deposit');
              setIsRequestListModalVisible(true);
            }}
          >
            <View style={styles.gridHeaderRow}>
              <View style={[styles.gridIconBg, { backgroundColor: colors.accentLight }]}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 19V5M5 12l7-7 7 7"
                    stroke={colors.accent}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>Total Deposited</Text>
            </View>
            <Text style={[styles.gridAmount, { color: colors.textPrimary }]}>₹{parseFloat(earningsData.total_deposits || '0').toFixed(2)}</Text>
          </Pressable>
        </View>

        {/* Total Delivered Order Value Card (Full-width, matching the sleek slate theme of Cash in Hand card) */}
        <View style={[styles.heroCard, { backgroundColor: isDarkMode ? '#1e293b' : '#334155', borderColor: colors.border, padding: 14, marginBottom: 8 }]}>
          <View style={styles.heroContent}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroLabel, { color: 'rgba(255, 255, 255, 0.7)' }]}>TOTAL DELIVERED ORDER VALUE</Text>
              <Text style={[styles.heroAmount, { color: '#ffffff', fontSize: 22, marginBottom: 2, fontFamily: 'Inter-Bold' }]}>₹{parseFloat(earningsData.total_delivered_order_amount || '0').toFixed(2)}</Text>
              <Text style={[styles.heroSub, { color: 'rgba(255, 255, 255, 0.8)', fontSize: 11 }]}>Combined COD + Online order values delivered</Text>
            </View>
          </View>
        </View>

        {/* Analytics Grid */}
        <View style={styles.analyticsGrid}>
          {/* Online Payment Card */}
          <View style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.gridHeaderRow}>
              <View style={[styles.gridIconBg, { backgroundColor: colors.accentLight }]}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21 4H3C1.89543 4 1 4.89543 1 6V18C1 19.1046 1.89543 20 3 20H21C22.1046 20 23 19.1046 23 18V6C23 4.89543 22.1046 4 21 4Z"
                    stroke={colors.accent}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M1 10H23"
                    stroke={colors.accent}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>Online Payments</Text>
            </View>
            <Text style={[styles.gridAmount, { color: colors.textPrimary }]}>₹{parseFloat(earningsData.online_order_amount || '0').toFixed(2)}</Text>
          </View>

          {/* COD Collection Card */}
          <View style={[styles.gridCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.gridHeaderRow}>
              <View style={[styles.gridIconBg, { backgroundColor: colors.accentLight }]}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                    stroke={colors.accent}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M12 6V12L16 14"
                    stroke={colors.accent}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>COD Collection</Text>
            </View>
            <Text style={[styles.gridAmount, { color: colors.textPrimary }]}>₹{parseFloat(earningsData.cod_amount_collected || '0').toFixed(2)}</Text>
          </View>
        </View>

        {/* Weekly/Monthly/Annual Trend Graph Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.chartHeaderRow}>
            <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>
              {selectedPeriod === 'today' || selectedPeriod === 'weekly' ? 'Weekly Trend' : selectedPeriod === 'monthly' ? 'Monthly Trend' : 'Historical Trend'}
            </Text>
            <View style={styles.trendContainer}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path d="M5 10l7-7 7 7" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.trendText}>
                {selectedPeriod === 'today' || selectedPeriod === 'weekly' ? '+12.4% Earning growth' : selectedPeriod === 'monthly' ? '+8.3% Monthly growth' : '+15.2% Overall growth'}
              </Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            {(earningsData.weekly_trend || []).map((bar: any, index: number) => {
              const activeColor = colors.accent;
              const inactiveColor = isDarkMode ? '#232838' : '#e2e8f8';
              const amtVal = parseFloat(bar.amount);
              const isToday = index === 6;
              const fillColor = isToday ? activeColor : (isDarkMode ? '#007f5f' : '#81d8ae');
              const barHeightPct = (amtVal / maxWeeklyAmount) * 80; // Scale to fit comfortably below the text label

              return (
                <View key={index} style={styles.graphColumn}>
                  <Text style={{ fontSize: 9, color: colors.textSecondary, fontFamily: 'Inter-Medium', marginBottom: 4 }}>
                    ₹{amtVal > 0 ? amtVal.toFixed(0) : '0'}
                  </Text>
                  <View style={[styles.graphBarBg, { backgroundColor: inactiveColor, height: 80 }]}>
                    <View style={[styles.graphBarFill, { height: `${barHeightPct}%`, backgroundColor: fillColor }]} />
                  </View>
                  <Text style={[
                    styles.graphLabel,
                    { color: isToday ? colors.accent : colors.textSecondary },
                    isToday && styles.graphLabelActive
                  ]}>
                    {bar.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Performance Rewards Card (Coming Soon) */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, padding: 16 }]}>
          <Text style={[styles.chartTitle, { color: colors.textPrimary, marginBottom: 12 }]}>Performance Rewards</Text>
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" style={{ marginBottom: 8 }}>
              <Path
                d="M20 12V22H4V12M22 7H2V12H22V7ZM12 7C12 7 12 3 9.5 3C7 3 7 7 9.5 7H12ZM12 7C12 7 12 3 14.5 3C17 3 17 7 14.5 7H12Z"
                stroke={colors.accent}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 15, color: colors.textPrimary, marginBottom: 4 }}>Coming Soon</Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textSecondary, textAlign: 'center' }}>
              Unlock milestones and earn extra bonuses for completed deliveries.
            </Text>
          </View>
        </View>

        {/* Earnings Breakdown Card */}
        <View style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.breakdownHeader, { backgroundColor: colors.inputBg, borderBottomColor: colors.border }]}>
            <Text style={[styles.breakdownHeaderTitle, { color: colors.textPrimary }]}>Earnings Breakdown</Text>
          </View>
          
          <View style={styles.breakdownBody}>
            {/* Base Pay */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownRowLeft}>
                <View style={[styles.breakdownDot, { backgroundColor: colors.accent }]} />
                <View>
                  <Text style={[styles.breakdownLabel, { color: colors.textPrimary }]}>Base Pay</Text>
                  <Text style={[styles.breakdownDesc, { color: colors.textSecondary }]}>Distance & Time Commissions</Text>
                </View>
              </View>
              <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>₹{parseFloat(earningsData.total_earnings_history || '0').toFixed(2)}</Text>
            </View>
            

            {/* Tips */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownRowLeft}>
                <View style={[styles.breakdownDot, { backgroundColor: '#3b82f6' }]} />
                <View>
                  <Text style={[styles.breakdownLabel, { color: colors.textPrimary }]}>Tips</Text>
                  <Text style={[styles.breakdownDesc, { color: colors.textSecondary }]}>Customer Gratitude</Text>
                </View>
              </View>
              <Text style={[styles.breakdownValue, { color: '#3b82f6' }]}>+₹0.00</Text>
            </View>

            <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />

            {/* Total Row */}
            <View style={[styles.breakdownRow, { marginTop: 4 }]}>
              <Text style={[styles.breakdownTotalLabel, { color: colors.textPrimary }]}>Total</Text>
              <Text style={[styles.breakdownTotalValue, { color: colors.accent }]}>₹{parseFloat(earningsData.total_earnings_history || '0').toFixed(2)}</Text>
            </View>

            {/* Dedicated View All Earnings Transactions Button */}
            <Pressable
              onPress={() => setIsEarningsTransactionsModalVisible(true)}
              style={{
                marginTop: 14,
                backgroundColor: colors.accentLight,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderWidth: 1,
                borderColor: colors.accent,
              }}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  stroke={colors.accent}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={{ fontFamily: 'Inter-Bold', fontSize: 13, color: colors.accent }}>
                View All Earnings Transactions
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Recent Withdrawal Activity */}
        <View style={styles.activityContainer}>
          <View style={styles.activityHeaderRow}>
            <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Recent Activity</Text>
            <CustomButton
              title="View All"
              onPress={() => {
                setIsEarningsTransactionsModalVisible(true);
              }}
              style={styles.viewAllBtn}
              textStyle={[styles.viewAllBtnText, { color: colors.accent }]}
            />
          </View>

          {earningsData.recent_activity && earningsData.recent_activity.length > 0 ? (
            earningsData.recent_activity.slice(0, 10).map((activity: any) => (
              <View 
                key={activity.id} 
                style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.activityLeft}>
                  <View style={[
                    styles.activityIconBg, 
                    { backgroundColor: activity.amount.startsWith('-') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.15)' }
                  ]}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path
                        d={activity.amount.startsWith('-') ? "M5 12h14M12 5l7 7-7 7" : "M19 12H5M12 19l-7-7 7-7"}
                        stroke={activity.amount.startsWith('-') ? '#ef4444' : '#10b981'}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <View style={styles.activityTextContainer}>
                    <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>{activity.title}</Text>
                    <Text style={[styles.activityDate, { color: colors.textSecondary }]}>{activity.date}</Text>
                  </View>
                </View>

                <View style={styles.activityRight}>
                  <Text style={[
                    styles.activityAmount, 
                    { color: activity.amount.startsWith('-') ? '#ef4444' : '#10b981' }
                  ]}>
                    {activity.amount}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    { 
                      backgroundColor: 
                        activity.status === 'APPROVED' 
                          ? 'rgba(59, 130, 246, 0.15)' 
                          : activity.status === 'PENDING' 
                          ? 'rgba(245, 158, 11, 0.15)' 
                          : activity.status === 'FAILED' 
                          ? 'rgba(239, 68, 68, 0.15)' 
                          : 'rgba(16, 185, 129, 0.15)' 
                    }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { 
                        color: 
                          activity.status === 'APPROVED' 
                            ? '#3b82f6' 
                            : activity.status === 'PENDING' 
                            ? '#f59e0b' 
                            : activity.status === 'FAILED' 
                            ? '#ef4444' 
                            : '#10b981' 
                      }
                    ]}>
                      {activity.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyActivity}>
              <Text style={{ color: colors.textSecondary, fontFamily: 'Inter-Regular', fontSize: 13 }}>No recent activities found.</Text>
            </View>
          )}
        </View>

        <View style={[styles.bottomBarSpacer, { height: 75 + insets.bottom }]} />
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <BottomTabBar activeTab="earnings" />

      {/* Withdraw Modal */}
      <Modal
        visible={isWithdrawModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Withdraw Earnings</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Enter amount to transfer to bank. Available: ₹{availableWithdrawBalance.toFixed(2)}
              {pendingWithdrawAmount > 0 ? ` (₹${pendingWithdrawAmount.toFixed(2)} held in pending requests)` : ''}
            </Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
              <TextInput
                style={[
                  styles.modalInput, 
                  { 
                    flex: 1, 
                    marginBottom: 0,
                    color: colors.textPrimary, 
                    borderColor: isWithdrawExceeded ? '#ef4444' : colors.border, 
                    backgroundColor: colors.inputBg 
                  }
                ]}
                placeholder="₹ Enter Amount"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={inputAmount}
                onChangeText={setInputAmount}
              />
              <Pressable
                onPress={() => setInputAmount(availableWithdrawBalance > 0 ? availableWithdrawBalance.toFixed(2) : '0')}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: colors.accentLight,
                  borderWidth: 1,
                  borderColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: 'Inter-Bold', fontSize: 13, color: colors.accent }}>MAX</Text>
              </Pressable>
            </View>

            {isWithdrawExceeded && (
              <Text style={{ color: '#ef4444', fontFamily: 'Inter-Medium', fontSize: 12, marginTop: -4, marginBottom: 12 }}>
                ⚠️ Cannot exceed available balance of ₹{availableWithdrawBalance.toFixed(2)}
              </Text>
            )}

            <TextInput
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg, minHeight: 40, marginBottom: 16 }]}
              placeholder="Remarks / Note (Optional)"
              placeholderTextColor={colors.textSecondary}
              value={inputRemarks}
              onChangeText={setInputRemarks}
            />

            <View style={styles.modalBtnRow}>
              <Pressable 
                style={[styles.modalCancelBtn, { borderColor: colors.border }]} 
                onPress={() => setIsWithdrawModalVisible(false)}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              
              <Pressable 
                style={[
                  styles.modalSubmitBtn, 
                  { 
                    backgroundColor: isWithdrawValid ? colors.accent : (isDarkMode ? '#374151' : '#9ca3af'),
                    opacity: isWithdrawValid ? 1 : 0.6
                  }
                ]} 
                onPress={handleWithdrawSubmit}
                disabled={!isWithdrawValid}
              >
                <Text style={styles.modalSubmitBtnText}>Withdraw</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Deposit Modal */}
      <Modal
        visible={isDepositModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDepositModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Deposit Collected COD Cash</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Enter amount deposited to Admin or Store Vendor. Available to deposit: ₹{availableCashToDeposit.toFixed(2)}
              {pendingDepositAmount > 0 ? ` (₹${pendingDepositAmount.toFixed(2)} already pending verification)` : ''}
            </Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
              <TextInput
                style={[
                  styles.modalInput, 
                  { 
                    flex: 1, 
                    marginBottom: 0,
                    color: colors.textPrimary, 
                    borderColor: isDepositExceeded ? '#ef4444' : colors.border, 
                    backgroundColor: colors.inputBg 
                  }
                ]}
                placeholder="₹ Enter Amount"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={inputAmount}
                onChangeText={setInputAmount}
              />
              <Pressable
                onPress={() => setInputAmount(availableCashToDeposit > 0 ? availableCashToDeposit.toFixed(2) : '0')}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: colors.accentLight,
                  borderWidth: 1,
                  borderColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: 'Inter-Bold', fontSize: 13, color: colors.accent }}>MAX</Text>
              </Pressable>
            </View>

            {isDepositExceeded && (
              <Text style={{ color: '#ef4444', fontFamily: 'Inter-Medium', fontSize: 12, marginTop: -4, marginBottom: 12 }}>
                ⚠️ Cannot exceed available cash of ₹{availableCashToDeposit.toFixed(2)}
              </Text>
            )}

            <TextInput
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.inputBg, minHeight: 40, marginBottom: 16 }]}
              placeholder="Remarks / Handover Note (Optional)"
              placeholderTextColor={colors.textSecondary}
              value={inputRemarks}
              onChangeText={setInputRemarks}
            />

            <View style={styles.modalBtnRow}>
              <Pressable 
                style={[styles.modalCancelBtn, { borderColor: colors.border }]} 
                onPress={() => setIsDepositModalVisible(false)}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              
              <Pressable 
                style={[
                  styles.modalSubmitBtn, 
                  { 
                    backgroundColor: isDepositValid ? colors.accent : (isDarkMode ? '#374151' : '#9ca3af'),
                    opacity: isDepositValid ? 1 : 0.6
                  }
                ]} 
                onPress={handleDepositSubmit}
                disabled={!isDepositValid}
              >
                <Text style={styles.modalSubmitBtnText}>Submit Deposit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Request List Modal (Settlement Transactions - Slides from Right) */}
      {shouldRenderSettlement && (
        <Modal
          visible={true}
          transparent={true}
          statusBarTranslucent={true}
          animationType="none"
          onRequestClose={() => setIsRequestListModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.45)' }}>
            <Animated.View
              style={{
                flex: 1,
                backgroundColor: colors.background,
                paddingTop: insets.top,
                transform: [{ translateX: settlementSlideAnim }],
              }}
            >
          {/* Header */}
          <View style={[styles.topAppBar, { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={styles.headerContainer}>
              <Pressable onPress={() => setIsRequestListModalVisible(false)} style={styles.backButton} hitSlop={15}>
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
              <Text style={[styles.headerTitle, { color: colors.accent }]}>Settlement Transactions</Text>
              <Pressable onPress={() => setIsRequestListModalVisible(false)} style={styles.backButton} hitSlop={15}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M18 6L6 18M6 6l12 12"
                    stroke={colors.textSecondary}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            </View>
          </View>

          {/* Modal Content */}
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 10 }}>
            {/* 3-Tab Filter Switcher */}
            <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderRadius: 10, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: colors.border }}>
              {(['all', 'withdraw', 'deposit'] as const).map((tab) => {
                const isActive = activeRequestListTab === tab;
                const tabTitle = tab === 'all' ? 'All' : tab === 'withdraw' ? 'Withdrawals' : 'Deposits';
                return (
                  <Pressable
                    key={tab}
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      alignItems: 'center',
                      borderRadius: 8,
                      backgroundColor: isActive ? colors.accent : 'transparent',
                    }}
                    onPress={() => setActiveRequestListTab(tab)}
                  >
                    <Text style={{
                      fontFamily: isActive ? 'Inter-Bold' : 'Inter-Medium',
                      fontSize: 13,
                      color: isActive ? '#ffffff' : colors.textSecondary
                    }}>
                      {tabTitle}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Scrollable list */}
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.accent]} />
              }
            >
              {getFilteredTransactions().length > 0 ? (
                getFilteredTransactions().map((item: any) => {
                  const isWithdrawal = item.settlement_type === 'withdrawal' || item.type_category === 'withdrawal';
                  return (
                    <Pressable 
                      key={`${item.settlement_type}-${item.id || item.settlement_no}`} 
                      style={[
                        styles.activityCard, 
                        { 
                          backgroundColor: colors.card, 
                          borderColor: colors.border, 
                          flexDirection: 'column', 
                          alignItems: 'stretch',
                          padding: 14,
                          marginBottom: 12,
                          borderRadius: 14,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: isDarkMode ? 0.2 : 0.04,
                          shadowRadius: 3,
                          elevation: 2,
                        }
                      ]}
                      onPress={() => {
                        setSelectedTransaction(item);
                        setIsTransactionDetailsModalVisible(true);
                      }}
                    >
                      {/* Top Header Row: Settlement Number, Target Badge & Status */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8, flexWrap: 'wrap' }}>
                          <Text style={{ fontFamily: 'Inter-Bold', fontSize: 13, color: colors.accent, letterSpacing: 0.3 }}>
                            {item.settlement_no || `#DPS-${item.id}`}
                          </Text>
                          <View style={{ 
                            backgroundColor: (item.target_role === 'vendor' || item.target_role === 'Vendor') ? 'rgba(99, 102, 241, 0.12)' : 'rgba(59, 130, 246, 0.12)', 
                            paddingHorizontal: 7, 
                            paddingVertical: 2, 
                            borderRadius: 4 
                          }}>
                            <Text style={{ fontSize: 10, fontFamily: 'Inter-Bold', color: (item.target_role === 'vendor' || item.target_role === 'Vendor') ? '#6366f1' : '#3b82f6', textTransform: 'uppercase' }}>
                              {item.target_name || ((item.target_role === 'vendor' || item.target_role === 'Vendor') ? 'Store Vendor' : 'Admin')}
                            </Text>
                          </View>
                        </View>

                        <View style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              item.status === 'APPROVED'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : item.status === 'PENDING'
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)'
                          }
                        ]}>
                          <Text style={[
                            styles.statusText,
                            {
                              color:
                                item.status === 'APPROVED'
                                  ? '#10b981'
                                  : item.status === 'PENDING'
                                  ? '#f59e0b'
                                  : '#ef4444',
                              fontFamily: 'Inter-Bold',
                              fontSize: 10,
                            }
                          ]}>
                            {item.status}
                          </Text>
                        </View>
                      </View>

                      {/* Main Title & Amount Row */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                          <View style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: isWithdrawal ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                              <Path
                                d={isWithdrawal ? "M12 5v14M19 12l-7 7-7-7" : "M12 19V5M5 12l7-7 7 7"}
                                stroke={isWithdrawal ? "#ef4444" : "#10b981"}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </Svg>
                          </View>
                          <View>
                            <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 13, color: colors.textPrimary }}>
                              {isWithdrawal ? 'Earnings Withdrawal' : 'COD Cash Deposit'}
                            </Text>
                            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                              {item.date}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontFamily: 'Inter-Bold', fontSize: 16, color: isWithdrawal ? '#ef4444' : '#10b981' }}>
                          {isWithdrawal ? '-' : '+'}₹{parseFloat(item.amount).toFixed(2)}
                        </Text>
                      </View>

                      {/* Partner Request Note if present */}
                      {(item.partner_remarks || item.remarks) ? (
                        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 4, marginLeft: 42 }}>
                          Note: "{item.partner_remarks || item.remarks}"
                        </Text>
                      ) : null}

                      {/* Quick Snapshot of Payment / UTR */}
                      {item.status === 'APPROVED' && (item.payment_method || item.transaction_reference) ? (
                        <View style={{ marginTop: 6, marginLeft: 42, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 6, alignSelf: 'flex-start' }}>
                          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 10, color: '#10b981' }}>
                            {item.payment_method || 'Settled'} {item.transaction_reference ? `• UTR: ${item.transaction_reference}` : ''}
                          </Text>
                        </View>
                      ) : null}

                      {/* Quick Snapshot of Rejection */}
                      {item.status === 'REJECTED' && (item.admin_vendor_remarks || item.admin_remarks) ? (
                        <View style={{ marginTop: 6, marginLeft: 42, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 6, alignSelf: 'flex-start' }}>
                          <Text style={{ fontFamily: 'Inter-SemiBold', fontSize: 10, color: '#ef4444' }}>
                            Rejected: {item.admin_vendor_remarks || item.admin_remarks}
                          </Text>
                        </View>
                      ) : null}

                      {/* Action footer link to view full details modal */}
                      <View style={{
                        marginTop: 10,
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Inter-Regular', color: colors.textSecondary }}>
                          Tap to view full receipt
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ fontSize: 12, fontFamily: 'Inter-Bold', color: colors.accent }}>
                            View Details
                          </Text>
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <Path d="M9 5l7 7-7 7" stroke={colors.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                  <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
                    <Path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke={colors.textSecondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={{ color: colors.textSecondary, fontFamily: 'Inter-Medium', fontSize: 13, marginTop: 10 }}>
                    No {activeRequestListTab === 'withdraw' ? 'withdrawal' : activeRequestListTab === 'deposit' ? 'deposit' : 'settlement'} transactions found.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )}

  {/* Earnings Transactions Modal (Slides in from Right) */}
  <EarningsTransactionsModal
    visible={isEarningsTransactionsModalVisible}
    onClose={() => setIsEarningsTransactionsModalVisible(false)}
    partnerId={Number(partner?.id || 0)}
  />

      {/* Full-Screen Transaction Details Modal */}
      <Modal
        visible={isTransactionDetailsModalVisible}
        transparent={false}
        statusBarTranslucent={true}
        animationType="slide"
        onRequestClose={() => setIsTransactionDetailsModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
          {/* Header */}
          <View style={[styles.topAppBar, { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={styles.headerContainer}>
              <Pressable onPress={() => setIsTransactionDetailsModalVisible(false)} style={styles.backButton} hitSlop={15}>
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
              <Text style={[styles.headerTitle, { color: colors.accent }]}>Transaction Details</Text>
              <Pressable onPress={() => setIsTransactionDetailsModalVisible(false)} style={styles.backButton} hitSlop={15}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M18 6L6 18M6 6l12 12"
                    stroke={colors.textSecondary}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            </View>
          </View>

          {/* Modal Body */}
          {selectedTransaction && (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            >
              {/* Hero Status & Amount Card */}
              <View style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 18,
                padding: 22,
                alignItems: 'center',
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDarkMode ? 0.25 : 0.06,
                shadowRadius: 5,
                elevation: 3,
              }}>
                {/* Status Icon */}
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: selectedTransaction.status === 'APPROVED'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : selectedTransaction.status === 'PENDING'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}>
                  {selectedTransaction.status === 'APPROVED' ? (
                    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                      <Path d="M5 13l4 4L19 7" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  ) : selectedTransaction.status === 'PENDING' ? (
                    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                      <Circle cx="12" cy="12" r="9" stroke="#f59e0b" strokeWidth="2.5" />
                      <Path d="M12 7v5l3 3" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  ) : (
                    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                      <Circle cx="12" cy="12" r="9" stroke="#ef4444" strokeWidth="2.5" />
                      <Path d="M15 9l-6 6M9 9l6 6" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  )}
                </View>

                {/* Status Label Pill */}
                <View style={{
                  backgroundColor: selectedTransaction.status === 'APPROVED'
                    ? 'rgba(16, 185, 129, 0.12)'
                    : selectedTransaction.status === 'PENDING'
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)',
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 20,
                  marginBottom: 10,
                }}>
                  <Text style={{
                    fontSize: 12,
                    fontFamily: 'Inter-Bold',
                    color: selectedTransaction.status === 'APPROVED'
                      ? '#10b981'
                      : selectedTransaction.status === 'PENDING'
                      ? '#f59e0b'
                      : '#ef4444',
                    letterSpacing: 0.5,
                  }}>
                    {selectedTransaction.status === 'APPROVED'
                      ? 'SETTLEMENT APPROVED'
                      : selectedTransaction.status === 'PENDING'
                      ? 'PENDING VERIFICATION'
                      : 'SETTLEMENT REJECTED'}
                  </Text>
                </View>

                {/* Amount */}
                <Text style={{
                  fontSize: 32,
                  fontFamily: 'Inter-Bold',
                  color: (selectedTransaction.settlement_type === 'withdrawal' || selectedTransaction.type_category === 'withdrawal') ? '#ef4444' : '#10b981',
                  marginBottom: 4,
                }}>
                  {(selectedTransaction.settlement_type === 'withdrawal' || selectedTransaction.type_category === 'withdrawal') ? '-' : '+'}₹{parseFloat(selectedTransaction.amount || '0').toFixed(2)}
                </Text>

                {/* Type Description */}
                <Text style={{
                  fontSize: 14,
                  fontFamily: 'Inter-SemiBold',
                  color: colors.textPrimary,
                  marginBottom: 4,
                }}>
                  {(selectedTransaction.settlement_type === 'withdrawal' || selectedTransaction.type_category === 'withdrawal')
                    ? 'Earnings Withdrawal to Bank / UPI'
                    : 'Cash in Hand (COD) Handover Deposit'}
                </Text>

                {/* Date */}
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Inter-Regular',
                  color: colors.textSecondary,
                }}>
                  Requested on {selectedTransaction.date}
                </Text>
              </View>

              {/* Settlement Overview Card */}
              <View style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 14,
                padding: 16,
                marginBottom: 16,
              }}>
                <Text style={{
                  fontSize: 12,
                  fontFamily: 'Inter-Bold',
                  color: colors.accent,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}>
                  Settlement Overview
                </Text>

                {/* Settlement ID */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textSecondary }}>Settlement ID</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: colors.textPrimary }}>
                    {selectedTransaction.settlement_no || `#DPS-${selectedTransaction.id}`}
                  </Text>
                </View>

                {/* Transaction Type */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textSecondary }}>Type</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: colors.textPrimary }}>
                    {(selectedTransaction.settlement_type === 'withdrawal' || selectedTransaction.type_category === 'withdrawal') ? 'Wallet Payout (Withdrawal)' : 'COD Cash Deposit'}
                  </Text>
                </View>

                {/* Target Authority / Destination */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textSecondary }}>Designated Approver</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: colors.textPrimary }}>
                      {selectedTransaction.target_name || ((selectedTransaction.target_role === 'vendor' || selectedTransaction.target_role === 'Vendor') ? 'Store Vendor' : 'Platform Admin')}
                    </Text>
                    <View style={{
                      backgroundColor: (selectedTransaction.target_role === 'vendor' || selectedTransaction.target_role === 'Vendor') ? 'rgba(99, 102, 241, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}>
                      <Text style={{
                        fontSize: 10,
                        fontFamily: 'Inter-Bold',
                        color: (selectedTransaction.target_role === 'vendor' || selectedTransaction.target_role === 'Vendor') ? '#6366f1' : '#3b82f6',
                        textTransform: 'uppercase',
                      }}>
                        {selectedTransaction.target_role || 'Admin'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Requested Timestamp */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: selectedTransaction.processed_at ? 1 : 0, borderBottomColor: colors.border }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textSecondary }}>Requested Date</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textPrimary }}>
                    {selectedTransaction.date || selectedTransaction.requested_at}
                  </Text>
                </View>

                {selectedTransaction.processed_at ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textSecondary }}>Processed Date</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textPrimary }}>
                      {selectedTransaction.processed_at}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Payment & Approval Breakdown Card (if Approved) */}
              {selectedTransaction.status === 'APPROVED' && (
                <View style={{
                  backgroundColor: isDarkMode ? '#06281e' : '#ecfdf5',
                  borderColor: isDarkMode ? '#0d593d' : '#a7f3d0',
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 16,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter-Bold', color: '#10b981', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      Payment Receipt & Audit
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: isDarkMode ? '#94a3b8' : '#475569' }}>
                      {(selectedTransaction.settlement_type === 'withdrawal' || selectedTransaction.type_category === 'withdrawal') ? 'Payout Method' : 'Receipt Method'}
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: isDarkMode ? '#f1f5f9' : '#0f172a' }}>
                      {selectedTransaction.payment_method || 'Bank Transfer / IMPS / Cash'}
                    </Text>
                  </View>

                  {selectedTransaction.transaction_reference ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: isDarkMode ? '#94a3b8' : '#475569' }}>
                        Reference / UTR
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: isDarkMode ? '#f1f5f9' : '#0f172a' }}>
                        {selectedTransaction.transaction_reference}
                      </Text>
                    </View>
                  ) : null}

                  {selectedTransaction.approved_by_role ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: isDarkMode ? '#94a3b8' : '#475569' }}>
                        Approved By
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: isDarkMode ? '#f1f5f9' : '#0f172a' }}>
                        {selectedTransaction.approved_by_role}
                      </Text>
                    </View>
                  ) : null}

                  {(selectedTransaction.admin_vendor_remarks || selectedTransaction.admin_remarks) ? (
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: isDarkMode ? '#0d593d' : '#a7f3d0' }}>
                      <Text style={{ fontSize: 11, fontFamily: 'Inter-Regular', color: isDarkMode ? '#94a3b8' : '#475569', marginBottom: 2 }}>
                        Approver Remarks:
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter-Medium', color: isDarkMode ? '#f1f5f9' : '#0f172a', fontStyle: 'italic' }}>
                        "{selectedTransaction.admin_vendor_remarks || selectedTransaction.admin_remarks}"
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Rejection Notice & Fund Restoration (if Rejected) */}
              {selectedTransaction.status === 'REJECTED' && (
                <View style={{
                  backgroundColor: isDarkMode ? '#2d1215' : '#fef2f2',
                  borderColor: isDarkMode ? '#7f1d1d' : '#fecaca',
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 16,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter-Bold', color: '#ef4444', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      Settlement Rejection Notice
                    </Text>
                  </View>

                  {(selectedTransaction.admin_vendor_remarks || selectedTransaction.admin_remarks) ? (
                    <View style={{ marginBottom: 10 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter-Regular', color: isDarkMode ? '#fca5a5' : '#b91c1c' }}>
                        Reason given by {selectedTransaction.target_name || selectedTransaction.target_role || 'approver'}:
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: isDarkMode ? '#ffffff' : '#991b1b', marginTop: 2 }}>
                        "{selectedTransaction.admin_vendor_remarks || selectedTransaction.admin_remarks}"
                      </Text>
                    </View>
                  ) : null}

                  {(selectedTransaction.settlement_type === 'withdrawal' || selectedTransaction.type_category === 'withdrawal') ? (
                    <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', padding: 10, borderRadius: 8, marginTop: 4 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter-Medium', color: '#10b981' }}>
                        ✓ Balance Restored: ₹{parseFloat(selectedTransaction.amount).toFixed(2)} was credited back to your Withdrawable Wallet Balance automatically.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', padding: 10, borderRadius: 8, marginTop: 4 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Inter-Medium', color: '#f59e0b' }}>
                        ⚠ Notice: Cash is still counted in your Cash in Hand balance. Please hand over the physical cash to your {selectedTransaction.target_name || 'Admin'} and re-submit.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Bank Account / UPI Snapshot (For Withdrawals) */}
              {(selectedTransaction.settlement_type === 'withdrawal' || selectedTransaction.type_category === 'withdrawal') && (() => {
                const bank = parseBankSnapshot(selectedTransaction.bank_details_snapshot);
                return (
                  <View style={{
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 16,
                  }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Inter-Bold', color: colors.accent, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 }}>
                      Payout Bank Snapshot
                    </Text>

                    {bank ? (
                      <>
                        {bank.account_holder ? (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textSecondary }}>Account Holder</Text>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: colors.textPrimary }}>{bank.account_holder}</Text>
                          </View>
                        ) : null}

                        {bank.bank_name ? (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textSecondary }}>Bank Name</Text>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: colors.textPrimary }}>{bank.bank_name}</Text>
                          </View>
                        ) : null}

                        {bank.account_number ? (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textSecondary }}>Account Number</Text>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: colors.textPrimary }}>
                              {bank.account_number.length > 4 ? `••••••••${bank.account_number.slice(-4)}` : bank.account_number}
                            </Text>
                          </View>
                        ) : null}

                        {bank.ifsc_code ? (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: bank.upi_id ? 1 : 0, borderBottomColor: colors.border }}>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textSecondary }}>IFSC Code</Text>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: colors.textPrimary }}>{bank.ifsc_code}</Text>
                          </View>
                        ) : null}

                        {bank.upi_id ? (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textSecondary }}>UPI ID</Text>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter-SemiBold', color: colors.textPrimary }}>{bank.upi_id}</Text>
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textSecondary }}>
                        Registered delivery partner primary payout account
                      </Text>
                    )}
                  </View>
                );
              })()}

              {/* Partner Notes if present */}
              {(selectedTransaction.partner_remarks || selectedTransaction.remarks) ? (
                <View style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 16,
                }}>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter-Bold', color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
                    Your Request Note
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Inter-Regular', color: colors.textPrimary }}>
                    "{selectedTransaction.partner_remarks || selectedTransaction.remarks}"
                  </Text>
                </View>
              ) : null}

              {/* Close Button */}
              <CustomButton
                title="Close Details"
                onPress={() => setIsTransactionDetailsModalVisible(false)}
                style={{
                  backgroundColor: colors.accent,
                  marginTop: 6,
                  marginBottom: 16,
                }}
                textStyle={{
                  color: '#ffffff',
                  fontFamily: 'Inter-Bold',
                  fontSize: 15,
                }}
              />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Recent Activity History Modal */}
      <Modal
        visible={isActivityHistoryModalVisible}
        transparent={true}
        statusBarTranslucent={true}
        animationType="slide"
        onRequestClose={() => setIsActivityHistoryModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.card, paddingTop: insets.top }}>
          {/* Header */}
          <View style={[styles.topAppBar, { backgroundColor: colors.card, borderBottomWidth: 0 }]}>
            <View style={styles.headerContainer}>
              <View style={{ width: 24 }} />
              <Text style={[styles.headerTitle, { color: colors.accent }]}>Activity History</Text>
              <Pressable onPress={() => setIsActivityHistoryModalVisible(false)} style={styles.backButton} hitSlop={15}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M18 6L6 18M6 6l12 12"
                    stroke={colors.accent}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
            </View>
          </View>

          {/* Modal Content */}
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
            {/* Today & Week Filters */}
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 16 }}>
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderBottomWidth: 2,
                  borderBottomColor: activityPeriodFilter === 'today' ? colors.accent : 'transparent'
                }}
                onPress={() => setActivityPeriodFilter('today')}
              >
                <Text style={{
                  fontFamily: activityPeriodFilter === 'today' ? 'Inter-SemiBold' : 'Inter-Regular',
                  fontSize: 14,
                  color: activityPeriodFilter === 'today' ? colors.accent : colors.textSecondary
                }}>Today</Text>
              </Pressable>

              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderBottomWidth: 2,
                  borderBottomColor: activityPeriodFilter === 'week' ? colors.accent : 'transparent'
                }}
                onPress={() => setActivityPeriodFilter('week')}
              >
                <Text style={{
                  fontFamily: activityPeriodFilter === 'week' ? 'Inter-SemiBold' : 'Inter-Regular',
                  fontSize: 14,
                  color: activityPeriodFilter === 'week' ? colors.accent : colors.textSecondary
                }}>This Week</Text>
              </Pressable>
            </View>

            {/* Scrollable list */}
            <ScrollView 
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.accent]} />
              }
            >
              {getFilteredActivities().length > 0 ? (
                getFilteredActivities().map((activity: any) => (
                  <View 
                    key={activity.id} 
                    style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={styles.activityLeft}>
                      <View style={[
                        styles.activityIconBg, 
                        { backgroundColor: activity.amount.startsWith('-') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.15)' }
                      ]}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                          <Path
                            d={activity.amount.startsWith('-') ? "M5 12h14M12 5l7 7-7 7" : "M19 12H5M12 19l-7-7 7-7"}
                            stroke={activity.amount.startsWith('-') ? "#ef4444" : "#10b981"}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
                      <View style={styles.activityTextContainer}>
                        <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>{activity.title}</Text>
                        <Text style={[styles.activityDate, { color: colors.textSecondary }]}>{activity.date}</Text>
                      </View>
                    </View>

                    <View style={styles.activityRight}>
                      <Text style={[
                        styles.activityAmount, 
                        { color: activity.amount.startsWith('-') ? '#ef4444' : '#10b981' }
                      ]}>
                        {activity.amount}
                      </Text>
                      <View style={[
                        styles.statusBadge,
                        { 
                          backgroundColor: 
                            activity.status === 'APPROVED' 
                              ? 'rgba(59, 130, 246, 0.15)' 
                              : activity.status === 'PENDING' 
                              ? 'rgba(245, 158, 11, 0.15)' 
                              : activity.status === 'FAILED' 
                              ? 'rgba(239, 68, 68, 0.15)' 
                              : 'rgba(16, 185, 129, 0.15)' 
                        }
                      ]}>
                        <Text style={[
                          styles.statusText,
                          { 
                            color: 
                              activity.status === 'APPROVED' 
                                ? '#3b82f6' 
                                : activity.status === 'PENDING' 
                                ? '#f59e0b' 
                                : activity.status === 'FAILED' 
                                ? '#ef4444' 
                                : '#10b981' 
                          }
                        ]}>
                          {activity.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontFamily: 'Inter-Regular', fontSize: 13 }}>No activities found for this period.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          zIndex: 9999,
        }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
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
    paddingTop: 8,
    paddingBottom: 96,
  },
  periodSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 8,
  },
  periodBtn: {
    flex: 1,
    height: 36,
    borderRadius: 12,
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
  periodBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  blurDecorative1: {
    position: 'absolute',
    right: -30,
    bottom: -30,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#006c4a',
    opacity: 0.25,
  },
  blurDecorative2: {
    position: 'absolute',
    left: -20,
    top: -20,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#93eabe',
    opacity: 0.1,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  heroLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 38,
    color: '#ffffff',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  heroSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  withdrawBtn: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 132,
    height: 48,
    borderRadius: 4,
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    elevation: 0,
  },
  withdrawBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
  },
  analyticsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  gridCard: {
    flex: 1,
    borderRadius: 12,
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
    gap: 8,
    marginBottom: 10,
  },
  gridIconBg: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    flex: 1,
  },
  gridAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
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
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#10b981',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingHorizontal: 4,
  },
  graphColumn: {
    alignItems: 'center',
    flex: 1,
  },
  graphBarBg: {
    width: 14,
    height: 100,
    borderRadius: 3,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  graphBarFill: {
    width: '100%',
    borderRadius: 3,
  },
  graphLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
  },
  graphLabelActive: {
    fontFamily: 'Inter-Bold',
  },
  rewardRow: {
    paddingVertical: 4,
  },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  rewardRatio: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  rewardSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  rewardDivider: {
    height: 1,
    marginVertical: 16,
    opacity: 0.5,
  },
  breakdownCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
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
  breakdownHeader: {
    padding: 16,
    borderBottomWidth: 1,
  },
  breakdownHeaderTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  breakdownBody: {
    padding: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  breakdownDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    marginTop: 1,
  },
  breakdownValue: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
  },
  breakdownDivider: {
    height: 1,
    marginVertical: 8,
    opacity: 0.3,
  },
  breakdownTotalLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  breakdownTotalValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  activityContainer: {
    marginBottom: 12,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllBtn: {
    backgroundColor: 'transparent',
    height: 'auto',
    width: 'auto',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  viewAllBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  activityCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  activityLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  activityTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  activityIconBg: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    flexShrink: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 2,
  },
  activityDate: {
    flexShrink: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  activityRight: {
    width: 92,
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 4,
  },
  activityAmount: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    textAlign: 'right',
  },
  statusBadge: {
    maxWidth: '100%',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    fontFamily: 'Inter-Bold',
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'center',
    letterSpacing: 0.2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  modalInput: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  modalSubmitBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    color: '#ffffff',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActivity: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  gridFinanceCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    justifyContent: 'space-between',
    minHeight: 136,
  },
  financeCardLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  financeCardAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 8,
  },
  financeCardDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  financeCardAction: {
    backgroundColor: '#9df4c8',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  financeCardActionText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: '#002113',
  },
  financeCardActionSecondary: {
    backgroundColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  financeCardActionTextSecondary: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: '#0f172a',
  },
  financeCardAmountCompact: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginBottom: 2,
  },
  financeCardSubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
  },
});
