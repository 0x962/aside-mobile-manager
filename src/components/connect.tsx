import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NetworkPanel, PairingFlow } from '@/components/network-panel';
import { T } from '@/components/text';
import { C, S } from '@/constants/theme';
import { DEMO_HOST } from '@/lib/demo';
import { useSettings } from '@/lib/settings';

// The screen shown while no bridge host is configured: on first launch and
// after leaving demo mode. Finding and pairing live in NetworkPanel, which
// Settings shows too, so there is one implementation of both.
export function ConnectScreen() {
  const { update } = useSettings();
  const insets = useSafeAreaInsets();
  const [pairing, setPairing] = useState<{ host: string; name: string } | null>(null);

  if (pairing) return <PairingFlow target={pairing} onClose={() => setPairing(null)} />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Image
        source={require('../../assets/images/aside-clouds.png')}
        style={styles.sky}
        contentFit="cover"
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', C.bg]}
        style={styles.skyFade}
        pointerEvents="none"
      />
      <View style={styles.header}>
        <View style={styles.headerButton} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={styles.headerButton}>
          <Ionicons name="settings-outline" size={19} color={C.inkSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + S.xl }]}>
        <View style={styles.hero}>
          <T variant="title">Connect to Aside</T>
          <T variant="secondary" style={{ textAlign: 'center' }}>
            Aside runs on your computer. This app starts{'\n'}and steers its sessions over your network.
          </T>
        </View>

        <NetworkPanel onPair={setPairing} />

        <Pressable onPress={() => update({ bridgeHost: DEMO_HOST })} style={styles.demoRow}>
          <Ionicons name="flask-outline" size={16} color={C.inkSecondary} />
          <View style={{ flex: 1 }}>
            <T variant="body">Demo</T>
            <T variant="faint">Explore with sample sessions, nothing to install.</T>
          </View>
          <Ionicons name="chevron-forward" size={15} color={C.inkFaint} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: 280, opacity: 0.5 },
  skyFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.sm },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: S.xl, gap: S.xl, flexGrow: 1 },
  hero: { alignItems: 'center', gap: S.sm, paddingTop: S.xxl },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surface,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: S.lg,
    marginTop: 'auto',
  },
});
