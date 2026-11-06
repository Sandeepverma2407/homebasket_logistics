import * as ImagePicker from 'expo-image-picker';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import CustomButton from '../components/CustomButton';
import { useTheme } from '../context/ThemeContext';
import BottomTabBar from '../components/BottomTabBar';
import { useAuth } from '../context/AuthContext';
import { resolveImageUrl, APP_NAME } from '../constants/constant';
import HelpSupportModal from '../components/HelpSupportModal';
import BrowseFaqsModal from '../components/BrowseFaqsModal';
import AboutUsModal from '../components/AboutUsModal';
import TermsPoliciesModal from '../components/TermsPoliciesModal';
import SoundSettingsModal from '../components/SoundSettingsModal';
import AlarmPermissionsModal from '../components/AlarmPermissionsModal';
import MyProfileModal from '../components/MyProfileModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePermissions } from '../hooks/usePermissions';
import { CustomAlert as Alert } from '../components/CustomAlert';
import CONFIG from '../connection/config';

const partnerAvatarImg = require('../../assets/images/partner-avatar.png');

const uriToBlob = (uri: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Unable to read the selected image.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
};

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { partner, logout, updatePartnerState } = useAuth();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [helpSupportVisible, setHelpSupportVisible] = useState(false);
  const [faqsVisible, setFaqsVisible] = useState(false);
  const [aboutUsVisible, setAboutUsVisible] = useState(false);
  const [termsPoliciesVisible, setTermsPoliciesVisible] = useState(false);
  const [soundSettingsVisible, setSoundSettingsVisible] = useState(false);
  const [alarmPermissionsVisible, setAlarmPermissionsVisible] = useState(false);
  const [myProfileVisible, setMyProfileVisible] = useState(false);
  const [currentSound, setCurrentSound] = useState<string>('Classic Bell');

  // Permission tracking – recheck whenever Settings screen comes into focus
  const { isLocationGranted, isNotificationGranted, recheckPermissions, openAppSettings } = usePermissions();
  useFocusEffect(
    useCallback(() => {
      recheckPermissions();
      // Ignore the result if the screen lost focus (e.g. logout) before the request finished
      let cancelled = false;
      if (partner?.id) {
        fetch(CONFIG.ENDPOINTS.PROFILE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partner_id: partner.id }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (!cancelled && data?.success && data?.user) {
              updatePartnerState(data.user);
            }
          })
          .catch((err) => {
            console.warn('Error refreshing profile in settings:', err);
          });
      }
      return () => {
        cancelled = true;
      };
    }, [recheckPermissions, partner?.id, updatePartnerState])
  );

  useEffect(() => {
    const loadSound = async () => {
      try {
        const saved = await AsyncStorage.getItem('order_alert_sound');
        if (saved) {
          setCurrentSound(saved);
        }
      } catch (e) {
        console.warn('Error loading sound preference:', e);
      }
    };
    loadSound();
  }, []);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert(
      'Logout Confirmation',
      'Are you sure you want to log out of your HB Logistics partner account?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  const performLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await logout();
      try {
        router.replace('/login');
      } catch {
        // Navigation guard in _layout.tsx handles redirection automatically
      }
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Logout Error', 'Unable to log out at this moment. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const pickImage = async () => {
    if (isUploadingProfileImage || !partner?.id) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to change your profile picture!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setProfileImage(asset.uri);
      setIsUploadingProfileImage(true);
      try {
        const formData = new FormData();
        formData.append('partner_id', String(partner.id));
        const fileName = asset.fileName || asset.uri.split('/').pop() || `profile_${Date.now()}.jpg`;
        const imageBlob = await uriToBlob(asset.uri);
        formData.append('profile_photo', imageBlob, fileName);

        const response = await fetch(CONFIG.ENDPOINTS.UPDATE_PROFILE_PHOTO, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
          body: formData,
        });
        const responseText = await response.text();
        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch {
          throw new Error(`Server returned an invalid response (HTTP ${response.status}).`);
        }
        if (!response.ok || !data.success || !data.profile_photo) {
          throw new Error(data.message || 'Failed to update profile photo.');
        }

        await updatePartnerState({ profile_photo: data.profile_photo });
        setProfileImage(null);
        Alert.alert('Success', 'Profile photo updated successfully.');
      } catch (error) {
        setProfileImage(null);
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update profile photo.');
      } finally {
        setIsUploadingProfileImage(false);
      }
    }
  };

  const rawPartnerType = partner?.partner_type || 'Central';
  const isVendorFleet = rawPartnerType.trim().toLowerCase().includes('vendor');
  const fleetLabel = rawPartnerType.trim().toLowerCase().includes('fleet')
    ? rawPartnerType.trim()
    : `${rawPartnerType.trim()} Fleet`;
  const partnerEmail = partner?.email || (partner as any)?.email_address || 'No email registered';

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header - TopAppBar */}
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
          <Text style={[styles.headerTitle, { color: colors.accent }]}>Settings</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Quick Glance */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable onPress={pickImage} disabled={isUploadingProfileImage} style={[styles.avatarContainer, isUploadingProfileImage && { opacity: 0.65 }]}>
            <View style={[styles.profileAvatarBorder, { borderColor: colors.accent, backgroundColor: colors.card }]}>
              <Image
                source={profileImage ? { uri: profileImage } : (partner?.profile_photo ? { uri: resolveImageUrl(partner.profile_photo) } : partnerAvatarImg)}
                style={styles.profileAvatar}
              />
            </View>
            <View style={[styles.avatarEditBadge, { backgroundColor: colors.accent }]}>
              <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx="12" cy="13" r="4" stroke="#ffffff" strokeWidth="2.5" />
              </Svg>
            </View>
          </Pressable>

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.textPrimary }]} numberOfLines={1}>
              {partner?.name || 'Partner'}
            </Text>

            {/* Partner Email Address */}
            <View style={styles.profileEmailRow}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                  stroke={colors.textSecondary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M22 6l-10 7L2 6"
                  stroke={colors.textSecondary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text
                style={[styles.profileEmailText, { color: colors.textSecondary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {partnerEmail}
              </Text>
            </View>

            {/* ID & Mobile with Fleet Tag */}
            <View style={styles.profileMetaContainer}>
              <Text style={[styles.profileMetaText, { color: colors.textSecondary }]}>ID: {partner?.DP_ID || `#${partner?.id || '---'}`}</Text>
              <Text style={[styles.profileMetaDivider, { color: colors.border }]}>|</Text>
              <Text style={[styles.profileMetaText, { color: colors.textSecondary }]}>
                {partner?.mobile_no ? (partner.mobile_no.startsWith('+91') ? partner.mobile_no : `+91 ${partner.mobile_no}`) : '---'}
              </Text>

              {/* Partner Fleet / Type Badge on right side of mobile number */}
              <View
                style={[
                  styles.fleetBadge,
                  isVendorFleet
                    ? {
                        backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb',
                        borderColor: isDarkMode ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
                      }
                    : {
                        backgroundColor: isDarkMode ? 'rgba(0, 200, 150, 0.12)' : '#ecfdf5',
                        borderColor: isDarkMode ? 'rgba(0, 200, 150, 0.3)' : '#a7f3d0',
                      },
                ]}
              >
                {isVendorFleet ? (
                  <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
                      stroke={isDarkMode ? '#fbbf24' : '#d97706'}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M9 22V12h6v10"
                      stroke={isDarkMode ? '#fbbf24' : '#d97706'}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                ) : (
                  <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"
                      stroke={isDarkMode ? '#34d399' : '#047857'}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Circle cx="5.5" cy="18.5" r="2.5" stroke={isDarkMode ? '#34d399' : '#047857'} strokeWidth="2.2" />
                    <Circle cx="18.5" cy="18.5" r="2.5" stroke={isDarkMode ? '#34d399' : '#047857'} strokeWidth="2.2" />
                  </Svg>
                )}
                <Text
                  style={[
                    styles.fleetBadgeText,
                    {
                      color: isVendorFleet
                        ? (isDarkMode ? '#fbbf24' : '#b45309')
                        : (isDarkMode ? '#34d399' : '#047857'),
                    },
                  ]}
                >
                  {fleetLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Warning Banner if Notifications / Alarms blocked */}
        {!isNotificationGranted && (
          <Pressable 
            onPress={() => setAlarmPermissionsVisible(true)}
            style={{
              backgroundColor: '#7f1d1d25',
              borderColor: '#ef4444',
              borderWidth: 1,
              borderRadius: 16,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
              gap: 12
            }}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: 'Inter-Bold', fontSize: 13, color: '#f87171' }}>⚠️ Order Alarms May Not Ring</Text>
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                Push notification permission is turned OFF. Tap to enable now.
              </Text>
            </View>
            <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ fontFamily: 'Inter-Bold', fontSize: 12, color: '#ffffff' }}>Enable</Text>
            </View>
          </Pressable>
        )}

        {/* Section - Account Settings */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACCOUNT SETTINGS</Text>
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* My Profile Row */}
            <Pressable style={styles.listItem} onPress={() => setMyProfileVisible(true)}>
              <View style={styles.listItemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.iconBg }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                      stroke={colors.accent}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Circle cx="12" cy="7" r="4" stroke={colors.accent} strokeWidth="2.5" />
                  </Svg>
                </View>
                <Text style={[styles.listItemText, { color: colors.textPrimary }]}>My Profile</Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 5l7 7-7 7"
                  stroke={colors.textSecondary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          </View>
        </View>

        {/* Section - Preferences */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PREFERENCES</Text>
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Dark Mode Row */}
            <View style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.iconBg }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                      stroke={colors.accent}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={[styles.listItemText, { color: colors.textPrimary }]}>Dark Mode</Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: '#dce3f2', true: '#82f5c1' }}
                thumbColor={isDarkMode ? '#00C896' : '#ffffff'}
                ios_backgroundColor="#dce3f2"
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Notifications Row */}
            <Pressable onPress={() => router.push('/notifications')} style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.iconBg }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
                      stroke={colors.accent}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={[styles.listItemText, { color: colors.textPrimary }]}>Notifications</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {isNotificationGranted && (
                  <View style={styles.gpsOnBadge}>
                    <Text style={styles.gpsOnBadgeText}>ON</Text>
                  </View>
                )}
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 5l7 7-7 7"
                    stroke={colors.textSecondary}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Sound Settings Row */}
            <Pressable style={styles.listItem} onPress={() => setSoundSettingsVisible(true)}>
              <View style={styles.listItemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.iconBg }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"
                      stroke={colors.accent}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={[styles.listItemText, { color: colors.textPrimary }]}>Sound Settings</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textSecondary }}>{currentSound}</Text>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 5l7 7-7 7"
                    stroke={colors.textSecondary}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Alarm Permissions & Health Row */}
            <Pressable style={styles.listItem} onPress={() => setAlarmPermissionsVisible(true)}>
              <View style={styles.listItemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: isNotificationGranted ? colors.iconBg : '#7f1d1d25' }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                      stroke={isNotificationGranted ? colors.accent : '#ef4444'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <View style={{ marginLeft: 16 }}>
                  <Text style={[styles.listItemText, { marginLeft: 0, color: colors.textPrimary }]}>Alarm Permissions</Text>
                  <Text style={{ fontFamily: 'Inter-Regular', fontSize: 11, color: colors.textSecondary }}>
                    {isNotificationGranted ? 'Screen off ringing ready' : 'Tap to enable permissions'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ 
                  backgroundColor: isNotificationGranted ? '#064e3b' : '#7f1d1d',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 12
                }}>
                  <Text style={{ fontFamily: 'Inter-Bold', fontSize: 11, color: isNotificationGranted ? '#34d399' : '#f87171' }}>
                    {isNotificationGranted ? 'Active' : 'Fix Access'}
                  </Text>
                </View>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 5l7 7-7 7"
                    stroke={colors.textSecondary}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Section - App Settings */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APP SETTINGS</Text>
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Language Row */}
            <Pressable style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.iconBg }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="10" stroke={colors.accent} strokeWidth="2" />
                    <Path
                      d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                      stroke={colors.accent}
                      strokeWidth="2"
                    />
                  </Svg>
                </View>
                <Text style={[styles.listItemText, { color: colors.textPrimary }]}>Language</Text>
              </View>
              <View style={styles.listItemRightContainer}>
                <Text style={[styles.listItemRightValue, { color: colors.textSecondary }]}>English</Text>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 5l7 7-7 7"
                    stroke={colors.textSecondary}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* GPS Settings Row */}
            <Pressable style={styles.listItem} onPress={openAppSettings}>
              <View style={styles.listItemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.iconBg }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"
                      stroke={colors.accent}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Circle cx="12" cy="10" r="3" stroke={colors.accent} strokeWidth="2" />
                  </Svg>
                </View>
                <Text style={[styles.listItemText, { color: colors.textPrimary }]}>GPS Settings</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {isLocationGranted && (
                  <View style={styles.gpsOnBadge}>
                    <Text style={styles.gpsOnBadgeText}>ON</Text>
                  </View>
                )}
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 5l7 7-7 7"
                    stroke={colors.textSecondary}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Section - Help & Support */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>HELP & SUPPORT</Text>
          <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* 24/7 Help & Support Row */}
            <Pressable style={styles.listItem} onPress={() => setHelpSupportVisible(true)}>
              <View style={styles.listItemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.iconBg }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3"
                      stroke={colors.accent}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={[styles.listItemText, { color: colors.textPrimary }]}>24/7 Help & Support</Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 5l7 7-7 7"
                  stroke={colors.textSecondary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Browse FAQs Row */}
            <Pressable style={styles.listItem} onPress={() => setFaqsVisible(true)}>
              <View style={styles.listItemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.iconBg }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="10" stroke={colors.accent} strokeWidth="2" />
                    <Path
                      d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"
                      stroke={colors.accent}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={[styles.listItemText, { color: colors.textPrimary }]}>Browse FAQs</Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 5l7 7-7 7"
                  stroke={colors.textSecondary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* About Us Row */}
            <Pressable style={styles.listItem} onPress={() => setAboutUsVisible(true)}>
              <View style={styles.listItemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.iconBg }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="10" stroke={colors.accent} strokeWidth="2" />
                    <Path
                      d="M12 16v-4M12 8h.01"
                      stroke={colors.accent}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={[styles.listItemText, { color: colors.textPrimary }]}>About Us</Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 5l7 7-7 7"
                  stroke={colors.textSecondary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Terms & Policies Row */}
            <Pressable style={styles.listItem} onPress={() => setTermsPoliciesVisible(true)}>
              <View style={styles.listItemLeft}>
                <View style={[styles.iconWrapper, { backgroundColor: colors.iconBg }]}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                      stroke={colors.accent}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
                      stroke={colors.accent}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={[styles.listItemText, { color: colors.textPrimary }]}>Terms & Policies</Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 5l7 7-7 7"
                  stroke={colors.textSecondary}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          </View>
        </View>

        {/* Footer Actions */}
        <View style={styles.footerContainer}>
          <CustomButton
            title={isLoggingOut ? "Logging out..." : "Logout"}
            onPress={handleLogout}
            loading={isLoggingOut}
            disabled={isLoggingOut}
            leftIcon={
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            }
            style={styles.logoutButton}
          />
          <View style={styles.footerTextContainer}>
            <Text style={[styles.appVersion, { color: colors.textSecondary }]}>App Version v2.4.0</Text>
            <Text style={[styles.copyright, { color: colors.textSecondary }]}>© 2026 {APP_NAME} Logistics</Text>
          </View>
        </View>

        {/* Extra spacer at the bottom to prevent navbar overlap */}
        <View style={[styles.bottomBarSpacer, { height: 75 + insets.bottom }]} />
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <BottomTabBar activeTab="profile" />

      {/* Individual Help & Support Modals */}
      <HelpSupportModal
        visible={helpSupportVisible}
        onClose={() => setHelpSupportVisible(false)}
      />
      <BrowseFaqsModal
        visible={faqsVisible}
        onClose={() => setFaqsVisible(false)}
      />
      <AboutUsModal
        visible={aboutUsVisible}
        onClose={() => setAboutUsVisible(false)}
      />
      <TermsPoliciesModal
        visible={termsPoliciesVisible}
        onClose={() => setTermsPoliciesVisible(false)}
      />
      <SoundSettingsModal
        visible={soundSettingsVisible}
        onClose={() => setSoundSettingsVisible(false)}
        onSoundSaved={(soundName) => setCurrentSound(soundName)}
      />
      <AlarmPermissionsModal
        visible={alarmPermissionsVisible}
        onClose={() => setAlarmPermissionsVisible(false)}
        isNotificationGranted={isNotificationGranted}
        onOpenSettings={openAppSettings}
        currentSoundName={currentSound}
      />
      <MyProfileModal
        visible={myProfileVisible}
        onClose={() => setMyProfileVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topAppBar: {
    height: 64,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    textAlign: 'center',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },
  profileCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    width: 64,
    height: 64,
  },
  profileAvatarBorder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    padding: 2,
    overflow: 'hidden',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    marginBottom: 3,
  },
  profileEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  profileEmailText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    flexShrink: 1,
  },
  profileMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 2,
  },
  profileMetaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  profileMetaDivider: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
  },
  fleetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  fleetBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 10,
    letterSpacing: 0.2,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingLeft: 4,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    height: 72,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    marginLeft: 16,
  },
  listItemRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemRightValue: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    marginRight: 8,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  logoutButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    // Override default shadow settings to be flat
    shadowColor: 'transparent',
    elevation: 0,
  },
  footerTextContainer: {
    alignItems: 'center',
    marginTop: 24,
    gap: 4,
  },
  appVersion: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    opacity: 0.6,
    letterSpacing: 0.6,
  },
  copyright: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    opacity: 0.4,
    letterSpacing: 0.6,
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
  gpsOnBadge: {
    backgroundColor: '#00C896',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  gpsOnBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 11,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});
