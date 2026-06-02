import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from './useColorScheme';

type ThemeOverride = 'light' | 'dark' | null;

const ThemeContext = createContext<{
  colorScheme: 'light' | 'dark';
  toggleColorScheme: () => void;
  isDark: boolean;
}>({
  colorScheme: 'dark',
  toggleColorScheme: () => {},
  isDark: true,
});

export function ThemeContextProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeOverride>(null);

  useEffect(() => {
    AsyncStorage.getItem('theme_override').then(val => {
      if (val === 'light' || val === 'dark') setOverride(val);
    });
  }, []);

  const colorScheme = override || systemScheme || 'dark';
  const isDark = colorScheme === 'dark';

  const toggleColorScheme = () => {
    const next = isDark ? 'light' : 'dark';
    setOverride(next);
    AsyncStorage.setItem('theme_override', next);
  };

  return (
    <ThemeContext.Provider value={{ colorScheme, toggleColorScheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  return useContext(ThemeContext);
}
