import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View, Text, Pressable, Animated, Dimensions, Platform, ScrollView } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { BASE64_ALARM_SOUNDS } from '../constants/AlarmSoundsBase64';
import { syncSoundPreferenceToServer } from '../services/fcmService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SoundSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSoundSaved?: (soundName: string) => void;
}

export default function SoundSettingsModal({ visible, onClose, onSoundSaved }: SoundSettingsModalProps) {
  const { colors } = useTheme();
  const [shouldRender, setShouldRender] = useState(visible);
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Selected sound states
  const [selectedSound, setSelectedSound] = useState<string>('Classic Bell');
  const [playingSoundName, setPlayingSoundName] = useState<string | null>(null);

  // Animation controller
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
      loadSavedSound();
    } else {
      stopPlayback();
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible]);

  // Clean up playback on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const loadSavedSound = async () => {
    try {
      const saved = await AsyncStorage.getItem('order_alert_sound');
      if (saved && BASE64_ALARM_SOUNDS[saved]) {
        setSelectedSound(saved);
      }
    } catch (e) {
      console.warn('Error loading sound preference:', e);
    }
  };

  const stopPlayback = () => {
    setPlayingSoundName(null);
  };

  const handlePlayPreview = (soundName: string) => {
    if (playingSoundName === soundName) {
      stopPlayback();
    } else {
      setPlayingSoundName(soundName);
    }
  };

  const handleSaveSound = async (soundName: string) => {
    setSelectedSound(soundName);
    try {
      await AsyncStorage.setItem('order_alert_sound', soundName);
      const pid = await AsyncStorage.getItem('partner_id') || await AsyncStorage.getItem('user_id');
      if (pid) await syncSoundPreferenceToServer(parseInt(pid, 10), soundName);
      if (onSoundSaved) {
        onSoundSaved(soundName);
      }
    } catch (e) {
      console.warn('Error saving sound preference:', e);
    }
  };

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
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Sound Settings</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Body Content */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Active Sound Indicator Card */}
            <View style={[styles.activeSoundCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.bellIconCircle, { backgroundColor: '#EAFDF7' }]}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
                    stroke="#00C896"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={styles.activeSoundInfo}>
                <Text style={[styles.activeSoundLabel, { color: colors.textSecondary }]}>Active Order Alert Sound</Text>
                <Text style={[styles.activeSoundValue, { color: colors.textPrimary }]}>{selectedSound}</Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Choose Alert Sound</Text>

            {/* List of base64 alarm sounds */}
            <View style={[styles.soundsListContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {Object.keys(BASE64_ALARM_SOUNDS).map((soundName, index) => {
                const isSelected = selectedSound === soundName;
                const isPlaying = playingSoundName === soundName;
                return (
                  <View key={soundName}>
                    {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                    
                    <Pressable 
                      onPress={() => handleSaveSound(soundName)}
                      style={[styles.soundRowItem, isSelected && { backgroundColor: colors.iconBg }]}
                    >
                      {/* Left: Radio check indicator + Sound name */}
                      <View style={styles.soundRowLeft}>
                        <View style={[styles.radioCircle, { borderColor: isSelected ? '#00C896' : colors.border }]}>
                          {isSelected && <View style={styles.radioInnerCircle} />}
                        </View>
                        <Text style={[styles.soundNameText, { color: colors.textPrimary, fontFamily: isSelected ? 'Inter-Bold' : 'Inter-Medium' }]}>
                          {soundName}
                        </Text>
                      </View>

                      {/* Right: Play preview button */}
                      <Pressable 
                        onPress={() => handlePlayPreview(soundName)}
                        hitSlop={10}
                        style={[styles.playPreviewButton, { backgroundColor: isPlaying ? '#00C896' : colors.background, borderColor: colors.border }]}
                      >
                        {isPlaying ? (
                          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                            <Path d="M6 6h12v12H6z" fill="#ffffff" />
                          </Svg>
                        ) : (
                          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                            <Path d="M8 5v14l11-7z" fill={colors.textPrimary} />
                          </Svg>
                        )}
                        <Text style={[styles.playButtonText, { color: isPlaying ? '#ffffff' : colors.textPrimary }]}>
                          {isPlaying ? 'Stop' : 'Preview'}
                        </Text>
                      </Pressable>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Explanatory Notice */}
            <View style={styles.noticeContainer}>
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                This sound will play continuously when you receive a new delivery job assignment alert, ensuring you never miss a request.
              </Text>
            </View>

            {/* Done button */}
            <Pressable onPress={onClose} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </ScrollView>

          {/* Hidden WebView for Audio Playback */}
          {playingSoundName && (
            <View style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}>
              <WebView
                originWhitelist={['*']}
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                onMessage={(event) => {
                  if (event.nativeEvent.data === 'ended') {
                    stopPlayback();
                  }
                }}
                source={{
                  html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    </head>
                    <body>
                      <audio id="player" autoplay src="${BASE64_ALARM_SOUNDS[playingSoundName]}"></audio>
                      <script>
                        const player = document.getElementById('player');
                        player.play().catch(err => {
                          console.log("Autoplay blocked:", err);
                        });
                        player.onended = () => {
                          window.ReactNativeWebView.postMessage('ended');
                        };
                      </script>
                    </body>
                    </html>
                  `
                }}
              />
            </View>
          )}
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
  activeSoundCard: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  bellIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSoundInfo: {
    flex: 1,
    gap: 4,
  },
  activeSoundLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
  },
  activeSoundValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    marginBottom: 12,
  },
  soundsListContainer: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  soundRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  soundRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00C896',
  },
  soundNameText: {
    fontSize: 14,
  },
  playPreviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
  },
  playButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 11,
  },
  divider: {
    height: 1,
  },
  noticeContainer: {
    marginTop: 16,
    paddingHorizontal: 4,
    marginBottom: 32,
  },
  noticeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  doneButton: {
    backgroundColor: '#00C896',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontFamily: 'Inter-Bold',
    color: '#ffffff',
    fontSize: 14,
  },
});
