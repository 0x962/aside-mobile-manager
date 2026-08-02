import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AmbientGlow } from '@/components/ambient-glow';
import { C } from '@/constants/theme';
import { DEMO_HOST } from '@/lib/demo';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SettingsContext, type Settings } from '@/lib/settings';

// Expo Go shows its own splash and registers no native one, so these calls
// raise "no native splash screen" there. A real build owns its splash and needs
// them, to hold it until the fonts and the saved settings are ready.
const ownsSplash = Constants.appOwnership !== 'expo';
if (ownsSplash) SplashScreen.preventAutoHideAsync().catch(() => {});

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
    if (ownsSplash && fontsLoaded && settings) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, settings]);

  if (!fontsLoaded || !settings) return null;

  const demo = settings.bridgeHost === DEMO_HOST;

  return (
    <SettingsContext.Provider value={ctx}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <View style={{ flex: 1 }}>
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
          <AmbientGlow />
          {demo && (
            <LinearGradient
              colors={['rgba(168,85,247,0)', 'rgba(168,85,247,0.22)']}
              style={styles.demoGradient}
              pointerEvents="none"
            />
          )}
        </View>
      </ThemeProvider>
    </SettingsContext.Provider>
  );
}

const styles = StyleSheet.create({
  // A tint over the bottom edge of every screen while demo mode is on. It
  // takes no touches and moves no layout; the exit chip lives on the
  // sessions screen.
  demoGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 },
});
