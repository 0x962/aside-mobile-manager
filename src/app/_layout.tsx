import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { C } from '@/constants/theme';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SettingsContext, type Settings } from '@/lib/settings';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.ink, border: C.border, primary: C.ink },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist: require('../../assets/fonts/Geist-Regular.ttf'),
    'Geist-Medium': require('../../assets/fonts/Geist-Medium.ttf'),
    'Geist-SemiBold': require('../../assets/fonts/Geist-SemiBold.ttf'),
    'Geist-Bold': require('../../assets/fonts/Geist-Bold.ttf'),
  });
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const ctx = useMemo(
    () => ({
      settings: settings ?? DEFAULT_SETTINGS,
      update: (patch: Partial<Settings>) => {
        setSettings((prev) => {
          const next = { ...(prev ?? DEFAULT_SETTINGS), ...patch };
          saveSettings(next);
          return next;
        });
      },
    }),
    [settings],
  );

  useEffect(() => {
    if (fontsLoaded && settings) SplashScreen.hideAsync();
  }, [fontsLoaded, settings]);

  if (!fontsLoaded || !settings) return null;

  return (
    <SettingsContext.Provider value={ctx}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.bg },
          }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="session/[id]" />
          <Stack.Screen name="new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </SettingsContext.Provider>
  );
}
