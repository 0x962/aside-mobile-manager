import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { T } from '@/components/text';
import { C, S } from '@/constants/theme';
import { DEMO_HOST } from '@/lib/demo';
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
          {demo && (
            <View pointerEvents="box-none" style={styles.demoLayer}>
              <Pressable
                onPress={() => ctx.update({ bridgeHost: '' })}
                hitSlop={{ top: 8, left: 8, right: 8, bottom: 0 }}
                style={styles.demoPill}>
                <Ionicons name="flask-outline" size={12} color={C.inkSecondary} />
                <T variant="label">Demo mode</T>
                <T variant="label" style={{ color: C.inkFaint }}>·</T>
                <T variant="label" style={{ color: C.ink }}>Exit</T>
              </Pressable>
            </View>
          )}
        </View>
      </ThemeProvider>
    </SettingsContext.Provider>
  );
}

const styles = StyleSheet.create({
  // Sits in the home-indicator zone, under the composer and the new-session
  // button, so no screen needs to make room for it.
  demoLayer: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' },
  demoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: S.md,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
  },
});
