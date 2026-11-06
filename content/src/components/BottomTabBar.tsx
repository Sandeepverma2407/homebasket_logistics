import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Pressable, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type TabType = 'home' | 'orders' | 'earnings' | 'profile';

interface BottomTabBarProps {
  activeTab: TabType;
  onTabPress?: (tab: TabType) => void;
}

export default function BottomTabBar({ activeTab, onTabPress }: BottomTabBarProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Animation values for scale of active tabs
  const homeScale = useRef(new Animated.Value(activeTab === 'home' ? 1.12 : 1)).current;
  const ordersScale = useRef(new Animated.Value(activeTab === 'orders' ? 1.12 : 1)).current;
  const earningsScale = useRef(new Animated.Value(activeTab === 'earnings' ? 1.12 : 1)).current;
  const profileScale = useRef(new Animated.Value(activeTab === 'profile' ? 1.12 : 1)).current;

  // Animation values for background pill opacity
  const homeBgOpacity = useRef(new Animated.Value(activeTab === 'home' ? 1 : 0)).current;
  const ordersBgOpacity = useRef(new Animated.Value(activeTab === 'orders' ? 1 : 0)).current;
  const earningsBgOpacity = useRef(new Animated.Value(activeTab === 'earnings' ? 1 : 0)).current;
  const profileBgOpacity = useRef(new Animated.Value(activeTab === 'profile' ? 1 : 0)).current;

  // Animation values for active dot scale
  const homeDotScale = useRef(new Animated.Value(activeTab === 'home' ? 1 : 0)).current;
  const ordersDotScale = useRef(new Animated.Value(activeTab === 'orders' ? 1 : 0)).current;
  const earningsDotScale = useRef(new Animated.Value(activeTab === 'earnings' ? 1 : 0)).current;
  const profileDotScale = useRef(new Animated.Value(activeTab === 'profile' ? 1 : 0)).current;

  useEffect(() => {
    // Run animations in parallel when activeTab changes
    Animated.parallel([
      // Scale Icon Animations
      Animated.spring(homeScale, { toValue: activeTab === 'home' ? 1.12 : 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.spring(ordersScale, { toValue: activeTab === 'orders' ? 1.12 : 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.spring(earningsScale, { toValue: activeTab === 'earnings' ? 1.12 : 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.spring(profileScale, { toValue: activeTab === 'profile' ? 1.12 : 1, useNativeDriver: true, tension: 50, friction: 7 }),

      // Background Pill Opacities
      Animated.timing(homeBgOpacity, { toValue: activeTab === 'home' ? 1 : 0, duration: 200, useNativeDriver: true }),
      Animated.timing(ordersBgOpacity, { toValue: activeTab === 'orders' ? 1 : 0, duration: 200, useNativeDriver: true }),
      Animated.timing(earningsBgOpacity, { toValue: activeTab === 'earnings' ? 1 : 0, duration: 200, useNativeDriver: true }),
      Animated.timing(profileBgOpacity, { toValue: activeTab === 'profile' ? 1 : 0, duration: 200, useNativeDriver: true }),

      // Active Dot Scale Animations
      Animated.spring(homeDotScale, { toValue: activeTab === 'home' ? 1 : 0, useNativeDriver: true, tension: 60, friction: 6 }),
      Animated.spring(ordersDotScale, { toValue: activeTab === 'orders' ? 1 : 0, useNativeDriver: true, tension: 60, friction: 6 }),
      Animated.spring(earningsDotScale, { toValue: activeTab === 'earnings' ? 1 : 0, useNativeDriver: true, tension: 60, friction: 6 }),
      Animated.spring(profileDotScale, { toValue: activeTab === 'profile' ? 1 : 0, useNativeDriver: true, tension: 60, friction: 6 }),
    ]).start();
  }, [activeTab]);

  const handlePress = (tab: TabType) => {
    if (onTabPress) {
      onTabPress(tab);
      return;
    }

    if (tab === activeTab) return;

    if (tab === 'home') {
      if (activeTab !== 'home') {
        router.back();
      }
    } else {
      if (activeTab === 'home') {
        if (tab === 'orders') router.push('/orders');
        else if (tab === 'earnings') router.push('/earnings');
        else if (tab === 'profile') router.push('/settings');
      } else {
        if (tab === 'orders') router.replace('/orders');
        else if (tab === 'earnings') router.replace('/earnings');
        else if (tab === 'profile') router.replace('/settings');
      }
    }
  };

  // Render modern SVG Home Icon
  const renderHomeIcon = (isActive: boolean, color: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      {isActive ? (
        <Path
          d="M12 3L3 9.5V20C3 20.8284 3.67157 21.5 4.5 21.5H9.5V14C9.5 13.4477 9.94772 13 10.5 13H13.5C14.0523 13 14.5 13.4477 14.5 14V21.5H19.5C20.3284 21.5 21 20.8284 21 20V9.5L12 3Z"
          fill={color}
        />
      ) : (
        <Path
          d="M3 9.5L12 3L21 9.5V20C21 20.8284 20.3284 21.5 19.5 21.5H4.5C3.67157 21.5 3 20.8284 3 20V9.5Z"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );

  // Render modern SVG Orders Icon
  const renderOrdersIcon = (isActive: boolean, color: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      {isActive ? (
        <>
          <Rect x="4" y="3" width="16" height="18" rx="3" fill={color} />
          <Path d="M8 8H16M8 12H16M8 16H12" stroke={colors.card} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <Rect x="4" y="3" width="16" height="18" rx="3" stroke={color} strokeWidth="2" />
          <Path d="M8 8H16M8 12H16M8 16H12" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );

  // Render modern SVG Earnings Icon
  const renderEarningsIcon = (isActive: boolean, color: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      {isActive ? (
        <>
          <Circle cx="12" cy="12" r="9" fill={color} />
          <Path
            d="M12 7V17M14.5 9.5H10.5C9.67 9.5 9 10.17 9 11C9 11.83 9.67 12.5 10.5 12.5H13.5C14.33 12.5 15 13.17 15 14C15 14.83 14.33 15.5 13.5 15.5H9.5"
            stroke={colors.card}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
          <Path
            d="M12 7V17M14.5 9.5H10.5C9.67 9.5 9 10.17 9 11C9 11.83 9.67 12.5 10.5 12.5H13.5C14.33 12.5 15 13.17 15 14C15 14.83 14.33 15.5 13.5 15.5H9.5"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Svg>
  );

  // Render modern SVG Profile Icon
  const renderProfileIcon = (isActive: boolean, color: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      {isActive ? (
        <>
          <Circle cx="12" cy="7" r="4.5" fill={color} />
          <Path
            d="M4.5 19.5C4.5 16.46 7.86 14 12 14C16.14 14 19.5 16.46 19.5 19.5V20.5H4.5V19.5Z"
            fill={color}
          />
        </>
      ) : (
        <>
          <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth="2" />
          <Path
            d="M5 19.5C5 16.5 8.1 14.5 12 14.5C15.9 14.5 19 16.5 19 19.5"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );

  const tabs: { key: TabType; label: string; scale: Animated.Value; bgOpacity: Animated.Value; dotScale: Animated.Value; renderIcon: (isActive: boolean, color: string) => React.ReactNode }[] = [
    {
      key: 'home',
      label: 'Home',
      scale: homeScale,
      bgOpacity: homeBgOpacity,
      dotScale: homeDotScale,
      renderIcon: renderHomeIcon,
    },
    {
      key: 'orders',
      label: 'Orders',
      scale: ordersScale,
      bgOpacity: ordersBgOpacity,
      dotScale: ordersDotScale,
      renderIcon: renderOrdersIcon,
    },
    {
      key: 'earnings',
      label: 'Earnings',
      scale: earningsScale,
      bgOpacity: earningsBgOpacity,
      dotScale: earningsDotScale,
      renderIcon: renderEarningsIcon,
    },
    {
      key: 'profile',
      label: 'Profile',
      scale: profileScale,
      bgOpacity: profileBgOpacity,
      dotScale: profileDotScale,
      renderIcon: renderProfileIcon,
    },
  ];

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8);

  return (
    <View style={[
      styles.bottomTabBar, 
      { 
        backgroundColor: colors.card, 
        borderTopColor: colors.border,
        paddingBottom: bottomPadding,
        shadowColor: colors.shadow,
      }
    ]}>
      <View style={styles.bottomTabBarContent}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const activeColor = colors.accent;
          const inactiveColor = colors.textSecondary;
          const tintColor = isActive ? activeColor : inactiveColor;

          return (
            <Pressable
              key={tab.key}
              onPress={() => handlePress(tab.key)}
              style={styles.tabItem}
            >
              <Animated.View style={[
                styles.tabIconWrapper,
                { transform: [{ scale: tab.scale }] }
              ]}>
                {/* Active Pill Background */}
                <Animated.View style={[
                  styles.activePill,
                  {
                    backgroundColor: colors.accentLight,
                    opacity: tab.bgOpacity,
                  }
                ]} />

                {/* SVG Icon */}
                <View style={styles.iconContainer}>
                  {tab.renderIcon(isActive, tintColor)}
                </View>
              </Animated.View>

              {/* Tab Text */}
              <Text style={[
                styles.tabText,
                { 
                  color: tintColor,
                  fontFamily: isActive ? 'Inter-Bold' : 'Inter-Medium',
                }
              ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    elevation: 8,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  bottomTabBarContent: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: 60,
    position: 'relative',
    paddingTop: 4,
  },
  tabIconWrapper: {
    width: 54,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  iconContainer: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
    position: 'absolute',
    bottom: 4,
  },
});
