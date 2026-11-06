import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View, Text, Pressable, Animated, Dimensions, Platform, ScrollView } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { APP_NAME } from '../constants/constant';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AboutUsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AboutUsModal({ visible, onClose }: AboutUsModalProps) {
  const { colors } = useTheme();
  const [shouldRender, setShouldRender] = useState(visible);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

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
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>About Us</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Body content */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Top Main Card */}
            <View style={[styles.mainCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Green Circle Brand Icon */}
              <View style={[styles.brandIconCircle, { backgroundColor: '#EAFDF7' }]}>
                <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.5 17h5M2.5 11h7.5l2-3h5l1.5 3H21"
                    stroke="#00C896"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path d="M13 5H8v3h5V5z" stroke="#00C896" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>

              <Text style={[styles.brandNameText, { color: colors.textPrimary }]}>{APP_NAME} Partner</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionBadgeText}>Version 2.4.0 (Build 2026.08)</Text>
              </View>
              <Text style={[styles.brandDescText, { color: colors.textSecondary }]}>
                Empowering modern delivery partners with real-time route optimization, automated earnings dispatch, and professional fleet logistics workflows.
              </Text>
            </View>

            {/* Stats Row (3 Columns) */}
            <View style={styles.statsRow}>
              {/* Stat 1 */}
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.statNumberText}>5,000+</Text>
                <Text style={styles.statLabelText}>Active Partners</Text>
              </View>
              {/* Stat 2 */}
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.statNumberText}>99.99%</Text>
                <Text style={styles.statLabelText}>System Uptime</Text>
              </View>
              {/* Stat 3 */}
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={styles.statNumberText}>1M+</Text>
                <Text style={styles.statLabelText}>Orders Daily</Text>
              </View>
            </View>

            {/* Section: Why Choose Us */}
            <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>Why Delivery Partners Choose Us</Text>

            {/* List Item 1 */}
            <View style={[styles.listItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.listIconBox, { backgroundColor: '#EAFDF7' }]}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"
                    stroke="#00C896"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Circle cx="12" cy="10" r="3" stroke="#00C896" strokeWidth="2" />
                </Svg>
              </View>
              <View style={styles.listItemCardInfo}>
                <Text style={[styles.listItemCardTitle, { color: colors.textPrimary }]}>Route Planning</Text>
                <Text style={styles.listItemCardSub}>Blazing fast 60fps routes with live traffic overlays and instant vendor/customer navigation.</Text>
              </View>
            </View>

            {/* List Item 2 */}
            <View style={[styles.listItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.listIconBox, { backgroundColor: '#FFF5EB' }]}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21 12V7H5a2 2 0 0 1 0-4h14M3 17V5a2 2 0 0 1 2-2h14v18H5a2 2 0 0 1-2-2z"
                    stroke="#FF9F43"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={styles.listItemCardInfo}>
                <Text style={[styles.listItemCardTitle, { color: colors.textPrimary }]}> Inventory Control</Text>
                <Text style={styles.listItemCardSub}>Automated package status checkpoints, vendor handover alerts, and secure digital signatures.</Text>
              </View>
            </View>

            {/* List Item 3 */}
            <View style={[styles.listItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.listIconBox, { backgroundColor: '#EAFDF7' }]}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"
                    stroke="#00C896"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={styles.listItemCardInfo}>
                <Text style={[styles.listItemCardTitle, { color: colors.textPrimary }]}>Instant Payouts</Text>
                <Text style={styles.listItemCardSub}>Automated daily settlement engine ensuring zero delays in receiving your delivery payouts.</Text>
              </View>
            </View>

            {/* Copyright block */}
            <View style={styles.copyrightContainer}>
              <Text style={styles.copyrightText}>© 2026 {APP_NAME} Technology Inc. All rights reserved.</Text>
              <Text style={styles.craftedText}>Crafted with ❤️ for Delivery Partners Worldwide</Text>
            </View>
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
  scrollContent: {
    padding: 20,
  },
  mainCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  brandIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brandNameText: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    textAlign: 'center',
  },
  versionBadge: {
    backgroundColor: '#EAFDF7',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 9999,
    marginTop: 6,
    marginBottom: 16,
  },
  versionBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    color: '#00C896',
  },
  brandDescText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumberText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    color: '#00C896',
  },
  statLabelText: {
    fontFamily: 'Inter-Medium',
    fontSize: 10,
    color: '#8A94A6',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionHeader: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    marginBottom: 16,
  },
  listItemCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  listIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemCardInfo: {
    flex: 1,
    gap: 4,
  },
  listItemCardTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
  listItemCardSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#8A94A6',
  },
  copyrightContainer: {
    marginTop: 32,
    marginBottom: 40,
    alignItems: 'center',
    gap: 6,
  },
  copyrightText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: '#8A94A6',
    textAlign: 'center',
  },
  craftedText: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: '#8A94A6',
    textAlign: 'center',
  },
});
