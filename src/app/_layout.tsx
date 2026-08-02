import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F, S } from '@/constants/theme';
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
              <LinearGradient
                colors={['rgba(168,85,247,0)', 'rgba(168,85,247,0.22)']}
                style={styles.demoGradient}
                pointerEvents="none"
              />
              <Pressable
                onPress={() => ctx.update({ bridgeHost: '' })}
                hitSlop={12}
                style={styles.demoTag}>
                <Text style={styles.demoText}>DEMO</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ThemeProvider>
    </SettingsContext.Provider>
  );
}

const styles = StyleSheet.create({
  // A tint over the bottom edge, out of every screen's layout; the tag sits
  // at the side, clear of the centered new-session button. Tap the tag to
  // exit demo mode.
  demoLayer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 130 },
  demoGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 130 },
  demoTag: { position: 'absolute', right: S.lg, bottom: 12 },
  demoText: { color: '#C084FC', fontFamily: F.bold, fontSize: 11, letterSpacing: 3 },
});
