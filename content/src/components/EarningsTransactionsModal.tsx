import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TextInput,
} from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { CONFIG } from '../connection/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type PeriodFilter = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';

interface TransactionItem {
  job_id: number;
  job_no: string;
  main_order_id: number;
  order_no: string;
  shop_name: string;
  earning: string;
  is_cod: boolean;
  cod_amount: string;
  payment_method: string;
  distance: string;
  date: string;
  display_date: string;
  day_name: string;
  relative_day: string | null;
  time: string;
  timestamp: string;
  status: string;
}

interface DateGroup {
  date: string;
  display_date: string;
  day_name: string;
  relative_day: string | null;
  day_total_earnings: string;
  day_trips_count: number;
  day_cod_collected: string;
  items: TransactionItem[];
}

interface EarningsTransactionsModalProps {
  visible: boolean;
  onClose: () => void;
  partnerId: number;
}

export const EarningsTransactionsModal: React.FC<EarningsTransactionsModalProps> = ({
  visible,
  onClose,
  partnerId,
}) => {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [shouldRender, setShouldRender] = useState(visible);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Filter states
  const [activeFilter, setActiveFilter] = useState<PeriodFilter>('today');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Custom date range states
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Data states
  const [dateRangeLabel, setDateRangeLabel] = useState('');
  const [summary, setSummary] = useState({
    total_earnings: '0.00',
    total_trips: 0,
    total_cod_collected: '0.00',
  });
  const [groupedTransactions, setGroupedTransactions] = useState<DateGroup[]>([]);

  // Slide Animation Controller (Right Side Open / Close)
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
      fetchTransactions(activeFilter);
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible]);

  // Fetch from backend
  const fetchTransactions = async (period: PeriodFilter, sDate = startDate, eDate = endDate) => {
    if (!partnerId) return;
    setLoading(true);
    try {
      let url = `${CONFIG.ENDPOINTS.GET_EARNINGS_TRANSACTIONS}?partner_id=${partnerId}&period=${period}`;
      if (period === 'custom') {
        url += `&start_date=${encodeURIComponent(sDate)}&end_date=${encodeURIComponent(eDate)}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data && data.success) {
        setDateRangeLabel(data.date_range_label || '');
        setSummary(data.summary || { total_earnings: '0.00', total_trips: 0, total_cod_collected: '0.00' });
        setGroupedTransactions(data.grouped_transactions || []);
      }
    } catch (error) {
      console.error('[EarningsTransactionsModal] Fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePeriodChange = (period: PeriodFilter) => {
    setActiveFilter(period);
    if (period !== 'custom') {
      fetchTransactions(period);
    } else {
      fetchTransactions('custom', startDate, endDate);
    }
  };

  const handleApplyCustomDates = () => {
    fetchTransactions('custom', startDate, endDate);
  };

  const adjustDate = (target: 'start' | 'end', days: number) => {
    const curStr = target === 'start' ? startDate : endDate;
    const curDate = new Date(curStr);
    curDate.setDate(curDate.getDate() + days);
    const newStr = curDate.toISOString().split('T')[0];
    if (target === 'start') {
      setStartDate(newStr);
    } else {
      setEndDate(newStr);
    }
  };

  if (!shouldRender) return null;

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalBackdrop}>
        <Animated.View
          style={[
            styles.modalDrawer,
            {
              backgroundColor: colors.background,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Pressable onPress={onClose} hitSlop={15} style={styles.headerBtn}>
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

            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Earnings Transactions</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {dateRangeLabel || 'Trip Payouts & History'}
              </Text>
            </View>

            <Pressable onPress={onClose} hitSlop={15} style={styles.headerBtn}>
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

          {/* Quick Date Range Filter Chips */}
          <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
              {(
                [
                  { key: 'today', label: 'Today' },
                  { key: 'yesterday', label: 'Yesterday' },
                  { key: 'week', label: 'This Week' },
                  { key: 'month', label: 'This Month' },
                  { key: 'all', label: 'All Time' },
                  { key: 'custom', label: 'Custom Range' },
                ] as const
              ).map((chip) => {
                const isActive = activeFilter === chip.key;
                return (
                  <Pressable
                    key={chip.key}
                    onPress={() => handlePeriodChange(chip.key)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isActive ? colors.accent : colors.background,
                        borderColor: isActive ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        {
                          color: isActive ? '#ffffff' : colors.textSecondary,
                          fontFamily: isActive ? 'Inter-Bold' : 'Inter-Medium',
                        },
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Custom Date Range Controls */}
            {activeFilter === 'custom' && (
              <View style={[styles.customDateContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.customDateRow}>
                  {/* Start Date */}
                  <View style={styles.dateControlBox}>
                    <Text style={[styles.dateControlLabel, { color: colors.textSecondary }]}>FROM</Text>
                    <View style={styles.stepperRow}>
                      <Pressable onPress={() => adjustDate('start', -1)} style={[styles.stepBtn, { borderColor: colors.border }]}>
                        <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>‹</Text>
                      </Pressable>
                      <TextInput
                        style={[styles.dateInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.card }]}
                        value={startDate}
                        onChangeText={setStartDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textSecondary}
                      />
                      <Pressable onPress={() => adjustDate('start', 1)} style={[styles.stepBtn, { borderColor: colors.border }]}>
                        <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>›</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* End Date */}
                  <View style={styles.dateControlBox}>
                    <Text style={[styles.dateControlLabel, { color: colors.textSecondary }]}>TO</Text>
                    <View style={styles.stepperRow}>
                      <Pressable onPress={() => adjustDate('end', -1)} style={[styles.stepBtn, { borderColor: colors.border }]}>
                        <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>‹</Text>
                      </Pressable>
                      <TextInput
                        style={[styles.dateInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.card }]}
                        value={endDate}
                        onChangeText={setEndDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.textSecondary}
                      />
                      <Pressable onPress={() => adjustDate('end', 1)} style={[styles.stepBtn, { borderColor: colors.border }]}>
                        <Text style={[styles.stepBtnText, { color: colors.textPrimary }]}>›</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                {/* Apply Button */}
                <Pressable
                  onPress={handleApplyCustomDates}
                  style={[styles.applyBtn, { backgroundColor: colors.accent }]}
                >
                  <Text style={styles.applyBtnText}>Apply Date Range</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Aggregated Summary Banner */}
          <View style={styles.summaryContainer}>
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]}>Total Earnings</Text>
                <Text style={[styles.summaryItemValue, { color: '#10b981' }]}>
                  ₹{parseFloat(summary.total_earnings || '0').toFixed(2)}
                </Text>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]}>Completed Trips</Text>
                <Text style={[styles.summaryItemValue, { color: colors.textPrimary }]}>{summary.total_trips}</Text>
              </View>

              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

              <View style={styles.summaryItem}>
                <Text style={[styles.summaryItemLabel, { color: colors.textSecondary }]}>COD Collected</Text>
                <Text style={[styles.summaryItemValue, { color: '#f59e0b' }]}>
                  ₹{parseFloat(summary.total_cod_collected || '0').toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Grouped Transactions List */}
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading transactions...</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    fetchTransactions(activeFilter);
                  }}
                  colors={[colors.accent]}
                />
              }
            >
              {groupedTransactions.length > 0 ? (
                groupedTransactions.map((group) => {
                  const headerTitle = group.relative_day
                    ? `${group.relative_day} • ${group.day_name}, ${group.display_date}`
                    : `${group.day_name}, ${group.display_date}`;

                  return (
                    <View key={group.date} style={styles.dateGroupContainer}>
                      {/* Date & Day Header with Subtotal */}
                      <View style={[styles.dateGroupHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.dateHeaderLeft}>
                          <View style={[styles.calendarIconBg, { backgroundColor: colors.accentLight }]}>
                            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                              <Path
                                d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
                                stroke={colors.accent}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </Svg>
                          </View>
                          <Text style={[styles.dateGroupTitle, { color: colors.textPrimary }]}>{headerTitle}</Text>
                        </View>

                        <View style={styles.dateHeaderRight}>
                          <Text style={[styles.dateGroupTotal, { color: '#10b981' }]}>
                            ₹{parseFloat(group.day_total_earnings).toFixed(2)}
                          </Text>
                          <Text style={[styles.dateGroupSub, { color: colors.textSecondary }]}>
                            {group.day_trips_count} {group.day_trips_count === 1 ? 'trip' : 'trips'}
                          </Text>
                        </View>
                      </View>

                      {/* Items for this date */}
                      {group.items.map((item) => (
                        <View
                          key={item.job_id}
                          style={[
                            styles.transactionCard,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <View style={styles.txCardLeft}>
                            {/* Scooter Icon */}
                            <View style={[styles.txIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                <Path
                                  d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7h2"
                                  stroke="#10b981"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <Circle cx="7" cy="17" r="2" stroke="#10b981" strokeWidth="2" />
                                <Circle cx="17" cy="17" r="2" stroke="#10b981" strokeWidth="2" />
                              </Svg>
                            </View>

                            {/* Details */}
                            <View style={styles.txInfoWrap}>
                              <View style={styles.txTitleRow}>
                                <Text style={[styles.txOrderNo, { color: colors.textPrimary }]}>
                                  Order #{item.order_no.length > 12 ? `${item.order_no.slice(-8)}` : item.order_no}
                                </Text>
                                <View style={styles.jobNoBadge}>
                                  <Text style={styles.jobNoBadgeText}>Job #{item.job_no}</Text>
                                </View>
                              </View>

                              <Text style={[styles.txShopName, { color: colors.textSecondary }]} numberOfLines={1}>
                                🏬 {item.shop_name}
                              </Text>

                              {/* Date, Day and Time line */}
                              <View style={styles.dateTimeRow}>
                                <Text style={[styles.txDateTime, { color: colors.textSecondary }]}>
                                  🗓 {item.day_name}, {item.display_date} • ⏰ {item.time}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Right Earnings & COD */}
                          <View style={styles.txCardRight}>
                            <Text style={styles.txEarningAmount}>+₹{item.earning}</Text>
                            <View style={styles.statusPill}>
                              <Text style={styles.statusPillText}>{item.status}</Text>
                            </View>
                            {item.is_cod && (
                              <View style={styles.codPill}>
                                <Text style={styles.codPillText}>COD ₹{item.cod_amount}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyContainer}>
                  <View style={[styles.emptyIconBg, { backgroundColor: colors.accentLight }]}>
                    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        stroke={colors.accent}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Transactions Found</Text>
                  <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                    No delivery trips completed for {dateRangeLabel || 'the selected period'}.
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalDrawer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    marginTop: 2,
  },
  filterBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterChipRow: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  customDateContainer: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  customDateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateControlBox: {
    flex: 1,
  },
  dateControlLabel: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stepBtn: {
    width: 28,
    height: 32,
    borderWidth: 1,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    lineHeight: 18,
  },
  dateInput: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderRadius: 6,
    textAlign: 'center',
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    paddingHorizontal: 4,
  },
  applyBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyBtnText: {
    fontFamily: 'Inter-Bold',
    color: '#ffffff',
    fontSize: 12,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  summaryCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryItemLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryItemValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 28,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  dateGroupContainer: {
    marginBottom: 16,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  dateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  calendarIconBg: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateGroupTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
  },
  dateHeaderRight: {
    alignItems: 'flex-end',
  },
  dateGroupTotal: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
  },
  dateGroupSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
  },
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  txCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  txIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txInfoWrap: {
    flex: 1,
    gap: 3,
  },
  txTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txOrderNo: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
  },
  jobNoBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  jobNoBadgeText: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    color: '#6366f1',
  },
  txShopName: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  txDateTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 10,
  },
  txCardRight: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 8,
  },
  txEarningAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: '#10b981',
  },
  statusPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillText: {
    fontFamily: 'Inter-Bold',
    fontSize: 9,
    color: '#10b981',
  },
  codPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codPillText: {
    fontFamily: 'Inter-Bold',
    fontSize: 9,
    color: '#f59e0b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 10,
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  emptyIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    marginBottom: 6,
  },
  emptySub: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
