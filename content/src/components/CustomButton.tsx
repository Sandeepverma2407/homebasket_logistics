import React from 'react';
import { StyleSheet, Text, Pressable, PressableProps, StyleProp, ViewStyle, TextStyle, View, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

export type ButtonVariant = 'primary' | 'accept';

interface CustomButtonProps extends PressableProps {
  title: string;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  loading?: boolean;
  leftIcon?: React.ReactNode;
}

export default function CustomButton({
  title,
  variant = 'primary',
  style,
  textStyle,
  disabled,
  leftIcon,
  loading,
  ...props
}: CustomButtonProps) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        isPrimary
          ? [styles.primary, { backgroundColor: colors.accent, shadowColor: colors.accent }]
          : [styles.accept, { backgroundColor: colors.accent, shadowColor: colors.accent }],
        pressed && styles.pressed,
        (disabled || loading) && [styles.disabled, { backgroundColor: colors.border }],
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      <View style={styles.contentContainer}>
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            {leftIcon}
            {!isPrimary && !leftIcon && (
              <View style={styles.iconContainer}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M10.0333 17.0333L18.2583 8.80833L16.625 7.175L10.0333 13.7667L6.70833 10.4417L5.075 12.075L10.0333 17.0333ZM11.6667 23.3333C10.0528 23.3333 8.53611 23.0271 7.11667 22.4146C5.69722 21.8021 4.4625 20.9708 3.4125 19.9208C2.3625 18.8708 1.53125 17.6361 0.91875 16.2167C0.30625 14.7972 0 13.2806 0 11.6667C0 10.0528 0.30625 8.53611 0.91875 7.11667C1.53125 5.69722 2.3625 4.4625 3.4125 3.4125C4.4625 2.3625 5.69722 1.53125 7.11667 0.91875C8.53611 0.30625 10.0528 0 11.6667 0C13.2806 0 14.7972 0.30625 16.2167 0.91875C17.6361 1.53125 18.8708 2.3625 19.9208 3.4125C20.9708 4.4625 21.8021 5.69722 22.4146 7.11667C23.0271 8.53611 23.3333 10.0528 23.3333 11.6667C23.3333 13.2806 23.0271 14.7972 22.4146 16.2167C21.8021 17.6361 20.9708 18.8708 19.9208 19.9208C18.8708 20.9708 17.6361 21.8021 16.2167 22.4146C14.7972 23.0271 13.2806 23.3333 11.6667 23.3333Z"
                    fill="white"
                  />
                </Svg>
              </View>
            )}
            <Text style={[isPrimary ? styles.primaryText : styles.acceptText, textStyle]}>
              {isPrimary ? title : title.toUpperCase()}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#006C49', // Dark forest green
    borderRadius: 16,
    width: '100%',
    height: 56,
    // Soft shadow
    shadowColor: '#006C49',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 6,
  },
  accept: {
    backgroundColor: '#006c49', // Dark forest green
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 171,
    height: 67,
    // Strong shadow
    shadowColor: '#006c49',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    backgroundColor: '#d1d5db',
    shadowColor: 'transparent',
    elevation: 0,
  },
  primaryText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#ffffff', // White text
    textAlign: 'center',
  },
  acceptText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    color: '#ffffff', // White text
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  iconContainer: {
    marginBottom: 4,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
