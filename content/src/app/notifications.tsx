import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, Pressable, Platform, FlatList } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import {
  AppNotification,
  getSavedNotifications,
  markAllNotificationsRead,
  toggleNotificationRead,
  clearAllNotifications,
} from '../services/notificationStorage';

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Reload notifications whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const loadNotifications = async () => {
    setLoading(true);
    const data = await getSavedNotifications();
    setNotifications(data);
    setLoading(false);
  };

  const handleMarkAllRead = async () => {
    const updated = await markAllNotificationsRead();
    setNotifications(updated);
  };

  const handleClearAll = async () => {
    await clearAllNotifications();
    setNotifications([]);
  };

  const handleToggleRead = async (id: string) => {
    const updated = await toggleNotificationRead(id);
    setNotifications(updated);
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'order':
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
              stroke={colors.accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path d="M17 21v-8H7v8M7 3v5h8" stroke={colors.accent} strokeWidth="2" />
          </Svg>
        );
      case 'payment':
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        );
      case 'bonus':
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        );
      default:
        return (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke={colors.textSecondary} strokeWidth="2" />
            <Path d="M12 16v-4M12 8h.01" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" />
          </Svg>
        );
    }
  };

  const getIconBg = (type: AppNotification['type']) => {
    switch (type) {
      case 'order':
        return colors.accentLight;
      case 'payment':
        return isDarkMode ? '#132d21' : '#e6fbf1';
      case 'bonus':
        return isDarkMode ? '#342312' : '#fef3c7';
      default:
        return colors.iconBg;
    }
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 12) }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.headerTitle, { color: colors.accent }]}>Notifications</Text>
        {notifications.length > 0 ? (
          <Pressable onPress={handleClearAll} hitSlop={10}>
            <Text style={[styles.clearText, { color: colors.textSecondary }]}>Clear All</Text>
          </Pressable>
        ) : (
          <View style={styles.headerRightPlaceholder} />
        )}
      </View>

      {/* Main Content */}
      {notifications.length > 0 ? (
        <View style={styles.container}>
          <View style={styles.subHeader}>
            <Text style={[styles.notificationCountText, { color: colors.textSecondary }]}>
              {notifications.filter((n) => n.unread).length} Unread
            </Text>
            {notifications.some((n) => n.unread) && (
              <Pressable onPress={handleMarkAllRead} hitSlop={10}>
                <Text style={[styles.markReadText, { color: colors.accent }]}>Mark all as read</Text>
              </Pressable>
            )}
          </View>

          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleToggleRead(item.id)}
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: item.unread ? colors.accent : colors.border,
                  },
                ]}
              >
                <View style={[styles.iconContainer, { backgroundColor: getIconBg(item.type) }]}>
                  {getIcon(item.type)}
                </View>
                <View style={styles.notificationInfo}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.cardTime, { color: colors.textSecondary }]}>
                      {item.time}
                    </Text>
                  </View>
                  <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
                    {item.body}
                  </Text>
                </View>
                {item.unread && (
                  <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
                )}
              </Pressable>
            )}
          />
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconBg, { backgroundColor: colors.iconBg }]}>
            <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
              <Path
                d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
                stroke={colors.textSecondary}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>All caught up!</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            We'll notify you here when you receive new orders, payments, or bonuses.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
  },
  clearText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    width: 60,
    textAlign: 'right',
  },
  headerRightPlaceholder: {
    width: 60,
  },
  container: {
    flex: 1,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notificationCountText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
  },
  markReadText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationInfo: {
    flex: 1,
    paddingRight: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  cardTime: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
  },
  cardBody: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 14,
    right: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
