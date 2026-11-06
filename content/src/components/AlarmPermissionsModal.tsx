import React from 'react';
import { Modal, StyleSheet, View, Text, Pressable, Platform, ScrollView } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface AlarmPermissionsModalProps {
  visible: boolean;
  onClose: () => void;
  isNotificationGranted: boolean;
  onOpenSettings: () => void;
  currentSoundName: string;
}

export default function AlarmPermissionsModal({
  visible,
  onClose,
  isNotificationGranted,
  onOpenSettings,
  currentSoundName,
}: AlarmPermissionsModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.shieldIconWrapper, { backgroundColor: isNotificationGranted ? '#064e3b' : '#7f1d1d' }]}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                    stroke={isNotificationGranted ? '#34d399' : '#f87171'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Order Alarm Permissions</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Background Ringing Health</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </Pressable>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Status Summary Banner */}
            <View
              style={[
                styles.statusBanner,
                {
                  backgroundColor: isNotificationGranted ? '#064e3b25' : '#7f1d1d25',
                  borderColor: isNotificationGranted ? '#059669' : '#dc2626',
                },
              ]}
            >
              <Text style={[styles.statusBannerTitle, { color: isNotificationGranted ? '#34d399' : '#f87171' }]}>
                {isNotificationGranted ? '🟢 Notifications Enabled' : '🔴 Notifications Are Blocked'}
              </Text>
              <Text style={[styles.statusBannerText, { color: colors.textSecondary }]}>
                {isNotificationGranted
                  ? 'Your app is configured to receive high-priority incoming order alerts.'
                  : 'Without notification permission, your phone will not ring when a new delivery order is assigned.'}
              </Text>
            </View>

            {/* Checklist of Essential Settings */}
            <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>ESSENTIAL PERMISSIONS CHECKLIST</Text>

            {/* 1. Push Notifications */}
            <View style={[styles.checklistItem, { borderColor: colors.border }]}>
              <View style={styles.itemHeader}>
                <View style={[styles.bulletCircle, { backgroundColor: isNotificationGranted ? '#00C896' : '#ef4444' }]}>
                  <Text style={styles.bulletText}>{isNotificationGranted ? '✓' : '!'}</Text>
                </View>
                <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>1. Push Notifications</Text>
                <Text style={[styles.badgeText, { color: isNotificationGranted ? '#00C896' : '#ef4444' }]}>
                  {isNotificationGranted ? 'Allowed' : 'Disabled'}
                </Text>
              </View>
              <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
                Allows the system to post incoming order notifications when the app is in background.
              </Text>
            </View>

            {/* 2. Full-Screen Alerts on Lockscreen */}
            <View style={[styles.checklistItem, { borderColor: colors.border }]}>
              <View style={styles.itemHeader}>
                <View style={[styles.bulletCircle, { backgroundColor: '#38bdf8' }]}>
                  <Text style={styles.bulletText}>⚡</Text>
                </View>
                <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>2. Full-Screen Notifications</Text>
                <Text style={[styles.badgeText, { color: '#38bdf8' }]}>Check Setting</Text>
              </View>
              <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
                In Phone Settings ➔ App Notifications ➔ ensure "Allow full-screen notifications" is toggled ON so the alert pops up on lock screen.
              </Text>
            </View>

            {/* 3. Battery Optimization (Doze Mode) */}
            <View style={[styles.checklistItem, { borderColor: colors.border }]}>
              <View style={styles.itemHeader}>
                <View style={[styles.bulletCircle, { backgroundColor: '#f59e0b' }]}>
                  <Text style={styles.bulletText}>🔋</Text>
                </View>
                <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>3. Battery Unrestricted</Text>
                <Text style={[styles.badgeText, { color: '#f59e0b' }]}>Recommended</Text>
              </View>
              <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
                In Phone Settings ➔ App Battery Usage ➔ select "Unrestricted" so Android does not put the app to sleep or delay order alarms.
              </Text>
            </View>

            {/* 4. Active Ringtone Sound */}
            <View style={[styles.checklistItem, { borderColor: colors.border }]}>
              <View style={styles.itemHeader}>
                <View style={[styles.bulletCircle, { backgroundColor: '#a855f7' }]}>
                  <Text style={styles.bulletText}>🔔</Text>
                </View>
                <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>4. Active Alarm Ringtone</Text>
                <Text style={[styles.badgeText, { color: '#a855f7' }]}>{currentSoundName}</Text>
              </View>
              <Text style={[styles.itemDescription, { color: colors.textSecondary }]}>
                This sound is linked to Android high-priority alarm channels (Bypasses DND).
              </Text>
            </View>
          </ScrollView>

          {/* Action Button */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable style={styles.settingsButton} onPress={onOpenSettings}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="3" stroke="#000000" strokeWidth="2" />
                <Path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                  stroke="#000000"
                  strokeWidth="2"
                />
              </Svg>
              <Text style={styles.settingsButtonText}>Open Phone Settings</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shieldIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  headerSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
  },
  scrollArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  statusBanner: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  statusBannerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    marginBottom: 4,
  },
  statusBannerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeading: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 12,
  },
  checklistItem: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  bulletCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  bulletText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  itemTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    flex: 1,
  },
  badgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
  },
  itemDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    paddingLeft: 30,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  settingsButton: {
    backgroundColor: '#00C896',
    borderRadius: 12,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  settingsButtonText: {
    color: '#000000',
    fontFamily: 'Inter-Bold',
    fontSize: 14,
  },
});
