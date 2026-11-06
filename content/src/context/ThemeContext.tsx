import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentLight: string;
  iconBg: string;
  tabBarBg: string;
  divider: string;
  statusBg: string;
  inputBg: string;
  textMuted: string;
  shadow: string;
}

const lightTheme: ThemeColors = {
  background: '#f9f9ff',
  surface: '#ffffff',
  card: '#ffffff',
  border: '#bec9c0',
  textPrimary: '#151c27',
  textSecondary: '#3f4943',
  accent: '#006C49',
  accentLight: 'rgba(0, 108, 73, 0.1)',
  iconBg: '#e7eefe',
  tabBarBg: '#f9f9ff',
  divider: '#bec9c0',
  statusBg: '#f9f9ff',
  inputBg: '#ffffff',
  textMuted: '#6c7a71',
  shadow: '#000000',
};

const darkTheme: ThemeColors = {
  background: '#0F1117',
  surface: '#191C24',
  card: '#191C24',
  border: '#2E3344',
  textPrimary: '#E8ECF4',
  textSecondary: '#8B8FA3',
  accent: '#00C896',
  accentLight: 'rgba(0, 200, 150, 0.15)',
  iconBg: '#232838',
  tabBarBg: '#111318',
  divider: '#2E3344',
  statusBg: '#0F1117',
  inputBg: '#111318',
  textMuted: '#555872',
  shadow: '#000000',
};

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Load theme preference on mount
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('app_theme_mode');
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'dark');
        }
      } catch (error) {
        console.warn('Error loading theme preference:', error);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    try {
      const nextMode = !isDarkMode;
      setIsDarkMode(nextMode);
      await AsyncStorage.setItem('app_theme_mode', nextMode ? 'dark' : 'light');
    } catch (error) {
      console.warn('Error saving theme preference:', error);
    }
  };

  const colors = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
