import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ComputerList, PairingFlow } from '@/components/computer-list';
import { CommandBlock, ExternalLink } from '@/components/legal';
import { T } from '@/components/text';
import { C, S } from '@/constants/theme';
import { DEMO_HOST } from '@/lib/demo';
import { ASIDE_URL, BREW_INSTALL, BREW_START, PAIR_AGAIN } from '@/lib/links';
import { useSettings } from '@/lib/settings';

// The screen shown while no computer is connected: on first launch, and after
// leaving demo mode. Pairing, the demo, and the explanations all start here.
export function ConnectScreen() {
  const { update } = useSettings();
  const insets = useSafeAreaInsets();
  const [pairing, setPairing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  if (pairing) return <PairingFlow onClose={() => setPairing(false)} />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Image
        source={require('../../assets/images/sky.png')}
        style={styles.sky}
        contentFit="cover"
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', C.bg]}
        style={styles.skyFade}
        pointerEvents="none"
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + S.xl }]}>
        <View style={styles.hero}>
          <T variant="title">Pair with your computer</T>
          <T variant="secondary" style={{ textAlign: 'center' }}>
            Aside runs on your computer. Pair once with{'\n'}the code it shows, then use it here.
          </T>
        </View>

        <ComputerList onPair={() => setPairing(true)} />

        <View style={styles.extras}>
          <Pressable onPress={() => setShowHelp((v) => !v)} style={styles.row}>
            <Ionicons name="help-circle-outline" size={16} color={C.inkSecondary} />
            <View style={{ flex: 1 }}>
              <T variant="body">How to install the bridge</T>
              <T variant="faint">Two commands on your computer</T>
            </View>
            <Ionicons name={showHelp ? 'chevron-up' : 'chevron-down'} size={15} color={C.inkFaint} />
          </Pressable>
          {showHelp && (
            <View style={{ gap: S.sm }}>
              <CommandBlock lines={[BREW_INSTALL, BREW_START]} />
              <T variant="faint">
                A pairing code opens on that computer the first time it starts. Run {PAIR_AGAIN} to
                show it again.
              </T>
            </View>
          )}

          <ExternalLink label="Learn about Aside" detail="aside.com" url={ASIDE_URL} icon="globe-outline" />

          <Pressable onPress={() => update({ bridgeHost: DEMO_HOST })} style={styles.row}>
            <Ionicons name="flask-outline" size={16} color={C.inkSecondary} />
            <View style={{ flex: 1 }}>
              <T variant="body">Try the demo</T>
              <T variant="faint">Sample sessions, nothing to install</T>
            </View>
            <Ionicons name="chevron-forward" size={15} color={C.inkFaint} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: 280, opacity: 0.5 },
  skyFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  body: { paddingHorizontal: S.xl, paddingTop: S.xxl, gap: S.xl, flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: S.sm },
  extras: { gap: S.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surface,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: S.md,
  },
});
