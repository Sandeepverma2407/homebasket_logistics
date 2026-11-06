import React, { useState, useEffect, useRef } from 'react';
import { Modal, StyleSheet, View, Text, Pressable, Animated, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  cancelable?: boolean;
}

interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
}

type AlertShowCallback = (config: AlertConfig) => void;
let globalAlertHandler: AlertShowCallback | null = null;

export const CustomAlert = {
  alert: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => {
    if (globalAlertHandler) {
      globalAlertHandler({ title, message, buttons, options });
    } else {
      // Fallback to Native Alert if root wrapper is not yet mounted
      import('react-native').then(({ Alert }) => {
        Alert.alert(title, message, buttons, options);
      });
    }
  }
};

export function CustomAlertRoot() {
  const { colors, isDarkMode } = useTheme();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({ title: '', message: '' });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    globalAlertHandler = (newConfig) => {
      setConfig(newConfig);
      setVisible(true);
    };
    return () => {
      globalAlertHandler = null;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  };

  const handleButtonPress = (onPress?: () => void) => {
    handleDismiss();
    if (onPress) {
      onPress();
    }
  };

  const handleBackdropPress = () => {
    if (config.options?.cancelable) {
      handleDismiss();
    }
  };

  if (!visible) return null;

  // Determine type & design based on title
  const getAlertStyle = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('success')) {
      return {
        type: 'success',
        color: isDarkMode ? '#00C896' : '#006C49',
        bgColor: isDarkMode ? 'rgba(0, 200, 150, 0.15)' : 'rgba(0, 108, 73, 0.1)',
        icon: (
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path
              d="M20 6L9 17L4 12"
              stroke={isDarkMode ? '#00C896' : '#006C49'}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )
      };
    } else if (t.includes('error') || t.includes('fail') || t.includes('denied')) {
      return {
        type: 'error',
        color: '#FF3B30',
        bgColor: isDarkMode ? 'rgba(255, 59, 48, 0.15)' : 'rgba(255, 59, 48, 0.1)',
        icon: (
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path
              d="M18 6L6 18M6 6l12 12"
              stroke="#FF3B30"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )
      };
    } else if (t.includes('insufficient') || t.includes('invalid') || t.includes('warning') || t.includes('limit')) {
      return {
        type: 'warning',
        color: '#FF9500',
        bgColor: isDarkMode ? 'rgba(255, 149, 0, 0.15)' : 'rgba(255, 149, 0, 0.1)',
        icon: (
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke="#FF9500" strokeWidth="2.5" />
            <Path d="M12 8v4" stroke="#FF9500" strokeWidth="3" strokeLinecap="round" />
            <Circle cx="12" cy="16" r="1.25" fill="#FF9500" />
          </Svg>
        )
      };
    } else {
      return {
        type: 'info',
        color: colors.accent,
        bgColor: colors.accentLight,
        icon: (
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke={colors.accent} strokeWidth="2.5" />
            <Path d="M12 16v-4" stroke={colors.accent} strokeWidth="3" strokeLinecap="round" />
            <Circle cx="12" cy="8" r="1.25" fill={colors.accent} />
          </Svg>
        )
      };
    }
  };

  const alertStyle = getAlertStyle(config.title);
  const buttons = config.buttons && config.buttons.length > 0 ? config.buttons : [{ text: 'OK' }];
  const isRow = buttons.length === 2;

  return (
    <Modal visible={true} transparent animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />

        {/* Modal Card */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
              shadowColor: colors.shadow,
            }
          ]}
        >
          {/* Glowing Icon Header */}
          <View style={[styles.iconContainer, { backgroundColor: alertStyle.bgColor }]}>
            {alertStyle.icon}
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.textPrimary }]}>{config.title}</Text>

          {/* Message */}
          {!!config.message && (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{config.message}</Text>
          )}

          {/* Buttons */}
          <View style={[styles.buttonsContainer, isRow ? styles.buttonsRow : styles.buttonsCol]}>
            {buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel' || btn.text?.toLowerCase() === 'cancel';
              const isDestructive = btn.style === 'destructive';

              let btnBg = alertStyle.color;
              let btnText = '#ffffff';
              let borderStyles = {};

              if (isCancel) {
                btnBg = 'transparent';
                btnText = colors.textSecondary;
                borderStyles = {
                  borderWidth: 1.5,
                  borderColor: colors.border,
                };
              } else if (isDestructive) {
                btnBg = '#FF3B30';
                btnText = '#ffffff';
              }

              return (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: btnBg, ...borderStyles },
                    isRow && { flex: 1 },
                    pressed && styles.buttonPressed
                  ]}
                  onPress={() => handleButtonPress(btn.onPress)}
                >
                  <Text
                    style={[
                      styles.buttonLabel,
                      { color: btnText, fontFamily: isCancel ? 'Inter-Medium' : 'Inter-SemiBold' }
                    ]}
                  >
                    {btn.text || 'OK'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 17, 23, 0.65)',
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonsCol: {
    flexDirection: 'column',
  },
  button: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonLabel: {
    fontSize: 16,
    textAlign: 'center',
  },
});
