import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View, Text, Pressable, Animated, Dimensions, Platform, ScrollView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { APP_NAME } from '../constants/constant';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'terms' | 'privacy' | 'settlement';

interface TermsPoliciesModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function TermsPoliciesModal({ visible, onClose }: TermsPoliciesModalProps) {
  const { colors } = useTheme();
  const [shouldRender, setShouldRender] = useState(visible);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabType>('terms');

  // Animation controller
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
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

  if (!shouldRender) return null;

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <Animated.View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.background,
              transform: [{ translateX: slideAnim }]
            }
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable onPress={onClose} hitSlop={15} style={styles.backButton}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6L6 18M6 6l12 12"
                  stroke={colors.textPrimary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Terms & Policies</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Horizontal scrollable tab chips switcher */}
          <View style={styles.tabsWrapper}>
            <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
              {/* Tab 1: Terms & Conditions */}
              <Pressable
                onPress={() => setActiveTab('terms')}
                style={[
                  styles.tabChip,
                  activeTab === 'terms' ? { backgroundColor: '#00C896' } : { backgroundColor: colors.card, borderColor: colors.border }
                ]}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                  <Path
                    d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    stroke={activeTab === 'terms' ? '#ffffff' : colors.textSecondary}
                    strokeWidth="2"
                  />
                </Svg>
                <Text style={[styles.tabChipText, activeTab === 'terms' ? { color: '#ffffff' } : { color: colors.textSecondary }]}>
                  Terms & Conditions
                </Text>
              </Pressable>

              {/* Tab 2: Privacy Policy */}
              <Pressable
                onPress={() => setActiveTab('privacy')}
                style={[
                  styles.tabChip,
                  activeTab === 'privacy' ? { backgroundColor: '#00C896' } : { backgroundColor: colors.card, borderColor: colors.border }
                ]}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                  <Path
                    d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                    stroke={activeTab === 'privacy' ? '#ffffff' : colors.textSecondary}
                    strokeWidth="2"
                  />
                </Svg>
                <Text style={[styles.tabChipText, activeTab === 'privacy' ? { color: '#ffffff' } : { color: colors.textSecondary }]}>
                  Privacy Policy
                </Text>
              </Pressable>

              {/* Tab 3: Settlement Policy */}
              <Pressable
                onPress={() => setActiveTab('settlement')}
                style={[
                  styles.tabChip,
                  activeTab === 'settlement' ? { backgroundColor: '#00C896' } : { backgroundColor: colors.card, borderColor: colors.border }
                ]}
              >
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                  <Path
                    d="M21 12V7H5a2 2 0 0 1 0-4h14M3 17V5a2 2 0 0 1 2-2h14v18H5a2 2 0 0 1-2-2z"
                    stroke={activeTab === 'settlement' ? '#ffffff' : colors.textSecondary}
                    strokeWidth="2"
                  />
                </Svg>
                <Text style={[styles.tabChipText, activeTab === 'settlement' ? { color: '#ffffff' } : { color: colors.textSecondary }]}>
                  Settlement Policy
                </Text>
              </Pressable>
            </ScrollView>
          </View>

          {/* Main Card Content Container */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.legalContentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Card Header Row */}
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardHeaderTitle, { color: colors.textPrimary }]}>
                  {activeTab === 'terms' ? 'Terms & Conditions' : activeTab === 'privacy' ? 'Privacy Policy' : 'Settlement Policy'}
                </Text>
                <View style={[styles.badgeContainer, { backgroundColor: '#EAFDF7' }]}>
                  <Text style={[styles.badgeText, { color: '#00C896' }]}>Updated August 2026</Text>
                </View>
              </View>

              {/* Display content based on activeTab */}
              {activeTab === 'terms' && (
                <View style={styles.contentBody}>
                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>1. Acceptance of Operating Terms</Text>
                  <Text style={[styles.sectionParagraph, { color: colors.textSecondary }]}>
                    By initializing and operating the {APP_NAME} Partner Mobile Application, you ("Partner") agree to be bound by these legal Terms and Conditions. These terms govern all dispatch assignments, route coordinates, tracking states, and payout logs performed through your partner account.
                  </Text>

                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>2. Partner Account Responsibilities</Text>
                  <Text style={[styles.sectionParagraph, { color: colors.textSecondary }]}>
                    Partners are solely responsible for maintaining strict confidentiality of login credentials, registered email links, and document verification tokens. All deliveries reported or modified using your active credentials will be deemed executed by the registered partner.
                  </Text>

                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>3. App License & Acceptable Use</Text>
                  <Text style={[styles.sectionParagraph, { color: colors.textSecondary }]}>
                    {APP_NAME} Logistics grants you a non-exclusive, non-transferable, revocable license to access and run the cloud application across designated mobile terminal hardware to receive, map, and process food delivery assignments.
                  </Text>

                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>4. System Maintenance & Uptime</Text>
                  <Text style={[styles.sectionParagraph, { color: colors.textSecondary }]}>
                    We guarantee 99.99% monthly system dispatch availability. Scheduled cloud database maintenance will be communicated at least 48 hours prior and conducted during off-peak hours (2:00 AM - 4:00 AM IST).
                  </Text>
                </View>
              )}

              {activeTab === 'privacy' && (
                <View style={styles.contentBody}>
                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>1. Information We Collect</Text>
                  <Text style={[styles.sectionParagraph, { color: colors.textSecondary }]}>
                    We collect document scans (driving license, vehicle registration, Aadhaar, PAN), profile photos, banking credentials for payout settlements, and device status details during session updates.
                  </Text>

                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>2. Background Location Tracking</Text>
                  <Text style={[styles.sectionParagraph, { color: colors.textSecondary }]}>
                    To dispatch nearby orders and record delivery audits, the app gathers active geographical coordinates in the background when your status switch is set to "Online", even when the app is minimized.
                  </Text>

                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>3. Data Security & Storage</Text>
                  <Text style={[styles.sectionParagraph, { color: colors.textSecondary }]}>
                    All coordinate logs, profile uploads, and banking details are encrypted and stored in secure cloud systems. We do not sell or lease partner information to any marketing providers.
                  </Text>
                </View>
              )}

              {activeTab === 'settlement' && (
                <View style={styles.contentBody}>
                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>1. Payout Processing Cycle</Text>
                  <Text style={[styles.sectionParagraph, { color: colors.textSecondary }]}>
                    All delivery payouts, distance commissions, and partner incentives are processed daily. Accumulated earnings are credited to your verified bank account by 10:00 AM on the following day (T+1 Settlement).
                  </Text>

                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>2. Transaction Fees and Deductions</Text>
                  <Text style={[styles.sectionParagraph, { color: colors.textSecondary }]}>
                    Dispute claims (e.g. food spillage, missing items, unapproved job cancellations) raised by vendors or consumers are audited by the support team and may result in partial settlement deductions.
                  </Text>

                  <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>3. Tax Deductions (TDS)</Text>
                  <Text style={[styles.sectionParagraph, { color: colors.textSecondary }]}>
                    TDS (Tax Deducted at Source) is automatically deducted from your daily earnings in compliance with national tax guidelines, and monthly TDS certificates will be available in your partner profile.
                  </Text>
                </View>
              )}
            </View>

            {/* Bottom spacing helper */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalCard: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        paddingTop: 16,
      },
    }),
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    textAlign: 'center',
    flex: 1,
  },
  placeholder: {
    width: 32,
  },
  tabsWrapper: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  tabsScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1,
  },
  tabChipText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },
  scrollContent: {
    padding: 20,
  },
  legalContentCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
    paddingBottom: 16,
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  badgeContainer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 10,
  },
  contentBody: {
    gap: 16,
  },
  sectionHeading: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    lineHeight: 18,
  },
  sectionParagraph: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 20,
  },
});
