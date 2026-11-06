import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  TextInput,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CustomAlert as Alert } from '../components/CustomAlert';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomButton from '@/components/CustomButton';
import CustomInput from '@/components/CustomInput';
import LoginHero from '@/components/LoginHero';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import CONFIG from '../connection/config';
import { APP_NAME } from '../constants/constant';

const logoImg = require('../../assets/images/exhome_logo.png');

type LoginMethod = 'otp' | 'password';

export default function LoginScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const heroHeight = 340 + insets.top;

  // Entrance animations (hero text first, then the form sheet)
  const introAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  // Form content fades in whenever the login method / OTP step changes
  const formAnim = useRef(new Animated.Value(1)).current;
  // Sliding pill behind the OTP / Password switcher
  const pillAnim = useRef(new Animated.Value(0)).current;
  const [segmentWidth, setSegmentWidth] = useState(0);

  // General States
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [method, setMethod] = useState<LoginMethod>('otp');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');

  // OTP specific States
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '']);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const otpRefs = useRef<Array<TextInput | null>>([]);

  // Prevent navigating back to protected screens from LoginScreen via Android Back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        // Block back button press when on login screen
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  useEffect(() => {
    Animated.timing(introAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    Animated.timing(sheetAnim, { toValue: 1, duration: 650, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [introAnim, sheetAnim]);

  useEffect(() => {
    Animated.spring(pillAnim, { toValue: method === 'otp' ? 0 : 1, friction: 9, tension: 90, useNativeDriver: true }).start();
  }, [method, pillAnim]);

  useEffect(() => {
    formAnim.setValue(0);
    Animated.timing(formAnim, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [method, otpSent, formAnim]);

  // Timer countdown hook for OTP resend
  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Helper to extract JSON even if server output contains HTML/PHP warning headers
  const parseJsonResponse = (text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  };

  const handleSendOtp = async () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSendingOtp(true);

    try {
      const response = await fetch(CONFIG.ENDPOINTS.SEND_OTP, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({ mobile_no: mobileNumber }),
      });
      const responseText = await response.text();
      const data = parseJsonResponse(responseText);

      if (!data) {
        console.error('Send OTP non-JSON response:', responseText);
        Alert.alert('Error', 'Server error. Please check server logs or API URL.');
        return;
      }

      if (data.success) {
        setOtpSent(true);
        setTimer(60); // Start 60s countdown
        if (data.is_demo || data.demo_otp) {
          const otpVal = data.demo_otp || '1234';
          setDemoOtp(otpVal);
          setOtpCode(otpVal.split(''));
        } else {
          setDemoOtp(null);
        }
      } else {
        Alert.alert('Error', data.message || 'Failed to send OTP.');
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      Alert.alert('Error', 'Network request failed. Please check connection.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    const enteredOtp = otpCode.join('');
    if (enteredOtp.length < 4) {
      Alert.alert('Error', 'Please enter the complete 4-digit OTP.');
      return;
    }

    setIsVerifyingOtp(true);

    try {
      const response = await fetch(CONFIG.ENDPOINTS.VERIFY_OTP, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({ mobile_no: mobileNumber, otp_code: enteredOtp }),
      });
      const responseText = await response.text();
      const data = parseJsonResponse(responseText);

      if (!data) {
        console.error('Verify OTP non-JSON response:', responseText);
        Alert.alert('Error', 'Server error. Please check server logs or API URL.');
        return;
      }

      if (data.success) {
        if (data.is_first_time) {
          Alert.alert(
            `Welcome to ${APP_NAME}! 🎉`,
            data.message || 'Your account password has been created and sent to your registered email address.'
          );
        }
        await login(data.user);
        router.replace('/home');
      } else {
        Alert.alert('Verification Failed', data.message || 'Invalid or expired OTP.');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      Alert.alert('Error', 'Network request failed. Please check connection.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!password) {
      Alert.alert('Error', 'Please enter your password.');
      return;
    }

    setIsLoggingIn(true);

    try {
      const response = await fetch(CONFIG.ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: CONFIG.HEADERS,
        body: JSON.stringify({ identifier: mobileNumber, password: password }),
      });
      const responseText = await response.text();
      const data = parseJsonResponse(responseText);

      if (!data) {
        console.error('Password login non-JSON response:', responseText);
        Alert.alert('Error', 'Server error. Please check server logs or API URL.');
        return;
      }

      if (data.success) {
        await login(data.user);
        router.replace('/home');
      } else {
        if (data.password_not_set) {
          Alert.alert(
            'First Time Login',
            data.message || 'Please log in with OTP first to receive your account password.',
            [
              { text: 'Switch to OTP', onPress: () => setMethod('otp') },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert('Login Failed', data.message || 'Invalid mobile/DP_ID or password.');
        }
      }
    } catch (error) {
      console.error('Password login error:', error);
      Alert.alert('Error', 'Network request failed. Please check connection.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otpCode];
    newOtp[index] = text;
    setOtpCode(newOtp);

    // Auto-focus next input box if typed a number
    if (text.length > 0 && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    // Navigate backwards on Backspace
    if (e.nativeEvent.key === 'Backspace' && otpCode[index] === '' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const resetOtpFlow = () => {
    setOtpSent(false);
    setOtpCode(['', '', '', '']);
    setTimer(0);
  };

  const segmentPillWidth = Math.max(0, (segmentWidth - 8) / 2);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Animated hero scene */}
          <LoginHero width={screenWidth} height={heroHeight} topInset={insets.top}>
            <Animated.View
              style={[
                styles.brandRow,
                {
                  paddingTop: insets.top + 14,
                  opacity: introAnim,
                  transform: [{ translateY: introAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
                },
              ]}
            >
              <View style={styles.logoBadge}>
                <Image source={logoImg} style={styles.logoImage} />
              </View>
              <Text style={styles.brandName}>{APP_NAME}</Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.taglineBlock,
                {
                  top: insets.top + 74,
                  opacity: introAnim,
                  transform: [{ translateX: introAnim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
                },
              ]}
            >
              <Text style={styles.taglineLine}>Deliver fast.</Text>
              <Text style={[styles.taglineLine, { color: '#00C896' }]}>Earn more.</Text>
              <Text style={styles.taglineSub}>Your next order is just a login away.</Text>
            </Animated.View>
          </LoginHero>

          {/* Form sheet */}
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
                opacity: sheetAnim,
                transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [48, 0] }) }],
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            {/* Header Text */}
            <View style={styles.headerTextContainer}>
              <Text style={[styles.welcomeText, { color: colors.textPrimary }]}>
                {otpSent ? 'OTP Verification' : 'Welcome Back'}
              </Text>
              <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>
                {otpSent
                  ? 'Enter the 4-digit code sent to your email'
                  : 'Choose your preferred login method below'}
              </Text>
            </View>

            {/* Login Method Segmented Switcher (Hidden when verifying OTP) */}
            {!otpSent && (
              <View
                style={[styles.segmentContainer, { backgroundColor: isDarkMode ? '#1C1E26' : '#F0F3F1' }]}
                onLayout={(e) => setSegmentWidth(e.nativeEvent.layout.width)}
              >
                {segmentWidth > 0 && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.segmentPill,
                      {
                        width: segmentPillWidth,
                        backgroundColor: colors.background,
                        transform: [
                          { translateX: pillAnim.interpolate({ inputRange: [0, 1], outputRange: [0, segmentPillWidth] }) },
                        ],
                      },
                    ]}
                  />
                )}
                <Pressable onPress={() => setMethod('otp')} style={styles.segmentButton}>
                  <Text
                    style={[
                      styles.segmentText,
                      { color: method === 'otp' ? colors.accent : colors.textMuted, fontFamily: method === 'otp' ? 'Inter-SemiBold' : 'Inter-Medium' }
                    ]}
                  >
                    OTP Login
                  </Text>
                </Pressable>
                <Pressable onPress={() => setMethod('password')} style={styles.segmentButton}>
                  <Text
                    style={[
                      styles.segmentText,
                      { color: method === 'password' ? colors.accent : colors.textMuted, fontFamily: method === 'password' ? 'Inter-SemiBold' : 'Inter-Medium' }
                    ]}
                  >
                    Password
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Input Form */}
            <Animated.View
              style={[
                styles.inputForm,
                {
                  opacity: formAnim,
                  transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                },
              ]}
            >
              {method === 'otp' ? (
                // --- OTP LOGIN FLOW ---
                !otpSent ? (
                  // Step 1: Mobile number entry
                  <>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Mobile Number</Text>
                    <CustomInput
                      prefixText="+91"
                      placeholder="Enter 10-digit mobile"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={mobileNumber}
                      onChangeText={setMobileNumber}
                    />
                    <CustomButton
                      title="Continue"
                      variant="primary"
                      onPress={handleSendOtp}
                      loading={isSendingOtp}
                      style={styles.actionButton}
                    />
                  </>
                ) : (
                  // Step 2: OTP Verification entry
                  <>
                    <View style={styles.numberRow}>
                      <Text style={[styles.verifyMessage, { color: colors.textSecondary }]}>
                        Sending OTP to registered email for{' '}
                        <Text style={{ fontFamily: 'Inter-SemiBold', color: colors.textPrimary }}>+91 {mobileNumber}</Text>
                      </Text>
                      <Pressable onPress={resetOtpFlow} style={styles.editButton}>
                        <Text style={[styles.editButtonText, { color: colors.accent }]}>Edit</Text>
                      </Pressable>
                    </View>

                    {/* Inline Success Alert Message */}
                    <View style={[styles.inlineAlert, { backgroundColor: colors.accentLight, borderColor: colors.accent + '30' }]}>
                      <Text style={[styles.inlineAlertText, { color: colors.accent }]}>
                        {demoOtp
                          ? `✓ Play Store Demo Mode: Use OTP ${demoOtp} to log in.`
                          : '✓ OTP has been sent successfully to your registered email address.'}
                      </Text>
                    </View>

                    {/* Premium Box OTP Grid */}
                    <View style={styles.otpGrid}>
                      {otpCode.map((digit, idx) => (
                        <TextInput
                          key={idx}
                          ref={(ref) => { otpRefs.current[idx] = ref; }}
                          style={[
                            styles.otpBox,
                            {
                              backgroundColor: colors.inputBg,
                              borderColor: digit ? colors.accent : colors.border,
                              color: colors.textPrimary,
                            }
                          ]}
                          keyboardType="number-pad"
                          maxLength={1}
                          value={digit}
                          onChangeText={(text) => handleOtpChange(text, idx)}
                          onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                          textAlign="center"
                          selectTextOnFocus
                        />
                      ))}
                    </View>

                    {/* Resend Helper & Timer */}
                    <View style={styles.resendContainer}>
                      {timer > 0 ? (
                        <Text style={[styles.resendText, { color: colors.textMuted }]}>
                          Resend OTP in <Text style={{ color: colors.textPrimary, fontFamily: 'Inter-SemiBold' }}>{timer}s</Text>
                        </Text>
                      ) : (
                        <Pressable onPress={handleSendOtp}>
                          <Text style={[styles.resendLink, { color: colors.accent }]}>Resend OTP via Email</Text>
                        </Pressable>
                      )}
                    </View>

                    <CustomButton
                      title="Verify & Login"
                      variant="primary"
                      onPress={handleVerifyOtp}
                      loading={isVerifyingOtp}
                      style={styles.actionButton}
                    />
                  </>
                )
              ) : (
                // --- PASSWORD LOGIN FLOW ---
                <>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Mobile Number</Text>
                  <CustomInput
                    prefixText="+91"
                    placeholder="Enter 10-digit mobile"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={mobileNumber}
                    onChangeText={setMobileNumber}
                  />

                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
                    <Pressable onPress={() => Alert.alert('Forgot Password', 'Please contact admin to reset password.')}>
                      <Text style={[styles.forgotText, { color: colors.accent }]}>Forgot?</Text>
                    </Pressable>
                  </View>
                  <CustomInput
                    placeholder="Enter account password"
                    secureTextEntry={true}
                    value={password}
                    onChangeText={setPassword}
                  />

                  <CustomButton
                    title="Sign In"
                    variant="primary"
                    onPress={handlePasswordLogin}
                    loading={isLoggingIn}
                    style={styles.actionButton}
                  />
                </>
              )}
            </Animated.View>

            {/* Footer Section */}
            <View style={styles.footerSection}>
              <View style={styles.trustRow}>
                <Text style={[styles.trustItem, { color: colors.textSecondary }]}>⚡ Instant orders</Text>
                <Text style={[styles.trustDot, { color: colors.textMuted }]}>•</Text>
                <Text style={[styles.trustItem, { color: colors.textSecondary }]}>💰 Daily payouts</Text>
                <Text style={[styles.trustDot, { color: colors.textMuted }]}>•</Text>
                <Text style={[styles.trustItem, { color: colors.textSecondary }]}>📍 Live tracking</Text>
              </View>
              <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
                By continuing, you agree to our{' '}
                <Text style={[styles.linkText, { color: colors.accent }]}>Terms & Conditions</Text>
                {' '}and{' '}
                <Text style={[styles.linkText, { color: colors.accent }]}>Privacy Policy</Text>
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  brandName: {
    fontFamily: 'Inter-Bold',
    fontSize: 19,
    letterSpacing: -0.4,
    color: '#FFFFFF',
  },
  taglineBlock: {
    position: 'absolute',
    left: 20,
    maxWidth: '58%',
  },
  taglineLine: {
    fontFamily: 'Inter-Bold',
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: '#FFFFFF',
  },
  taglineSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 8,
    color: 'rgba(255,255,255,0.72)',
  },
  sheet: {
    flexGrow: 1,
    marginTop: -32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    // no Android elevation: it draws a grey rectangular shadow behind the rounded top corners
    elevation: 0,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    opacity: 0.6,
    marginBottom: 16,
  },
  headerTextContainer: {
    marginBottom: 8,
    alignItems: 'center',
  },
  welcomeText: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    marginBottom: 4,
  },
  subtitleText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    marginBottom: 10,
  },
  segmentPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  segmentText: {
    fontSize: 14,
  },
  inputForm: {
    marginBottom: 6,
  },
  label: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    marginBottom: 0,
    marginTop: 2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 0,
  },
  forgotText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  actionButton: {
    marginTop: 8,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  verifyMessage: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  editButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: 13,
  },
  otpGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 8,
  },
  otpBox: {
    width: 56,
    height: 60,
    borderRadius: 14,
    borderWidth: 1.5,
    fontSize: 20,
    fontFamily: 'Inter-Bold',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  resendText: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
  },
  resendLink: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  footerSection: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 20,
    gap: 12,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  trustItem: {
    fontFamily: 'Inter-Medium',
    fontSize: 11.5,
  },
  trustDot: {
    fontSize: 10,
  },
  disclaimerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  linkText: {
    fontFamily: 'Inter-Bold',
  },
  inlineAlert: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  inlineAlertText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
