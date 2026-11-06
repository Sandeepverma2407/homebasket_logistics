import { Stack, SplashScreen, ThemeProvider as NavigationThemeProvider, DefaultTheme, DarkTheme, useRouter, useSegments } from 'expo-router';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, TextInput } from 'react-native';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { OrderAlertProvider } from '../context/OrderAlertContext';
import { CustomAlertRoot } from '../components/CustomAlert';
import { setupNotificationChannels } from '../services/fcmService';
import '../connection/config';

type ScalableTextComponent = {
  defaultProps?: {
    allowFontScaling?: boolean;
    maxFontSizeMultiplier?: number;
  };
};

const textDefaults = Text as typeof Text & ScalableTextComponent;
const textInputDefaults = TextInput as typeof TextInput & ScalableTextComponent;

textDefaults.defaultProps = {
  ...textDefaults.defaultProps,
  allowFontScaling: false,
  maxFontSizeMultiplier: 1,
};
textInputDefaults.defaultProps = {
  ...textInputDefaults.defaultProps,
  allowFontScaling: false,
  maxFontSizeMultiplier: 1,
};

SplashScreen.preventAutoHideAsync().catch(() => {});

function NavigationStack() {
  const { colors, isDarkMode } = useTheme();
  const { partner, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Setup Android high-priority notification channels
    setupNotificationChannels();
  }, []);

  useEffect(() => {
    // Dynamically update the native window background color to match the active theme.
    // This prevents any native white color from flashing behind screens during transitions.
    SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  // Auth Protection Navigation Guard: Ensures unauthenticated users cannot navigate back to protected screens
  useEffect(() => {
    if (isLoading) return;

    const currentScreen = (segments[0] as string) || '';
    const isPublicScreen = currentScreen === 'login' || currentScreen === '' || currentScreen === 'index';

    if (!partner && !isPublicScreen) {
      // User is logged out but trying to access a protected screen -> Redirect to login immediately
      router.replace('/login');
    } else if (partner && currentScreen === 'login') {
      // User is logged in but on login screen -> Redirect to home
      router.replace('/home');
    }
  }, [partner, isLoading, segments, router]);

  const baseTheme = isDarkMode ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseTheme,
    dark: isDarkMode,
    colors: {
      ...baseTheme.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: colors.background },
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" options={{ gestureEnabled: false }} />
        <Stack.Screen name="home" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="map" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="earnings" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="arrived" />
        <Stack.Screen name="complete" />
      </Stack>
      <CustomAlertRoot />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    'Inter': Inter_400Regular,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <OrderAlertProvider>
            <NavigationStack />
          </OrderAlertProvider>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
