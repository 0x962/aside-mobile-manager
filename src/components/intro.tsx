import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommandBlock, ExternalLink, LegalBrief } from '@/components/legal';
import { T } from '@/components/text';
import { C, S } from '@/constants/theme';
import { ASIDE_URL, BREW_INSTALL, BREW_START } from '@/lib/links';

export function IntroScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const last = page === 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Image
        source={require('../../assets/images/sky.png')}
        style={styles.sky}
        contentFit="cover"
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)', C.bg]}
        style={styles.skyFade}
        pointerEvents="none"
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        {page === 0 ? <WhatItIs /> : <HowItWorks />}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + S.lg }]}>
        <View style={styles.dots}>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Pressable
          onPress={() => (last ? onDone() : setPage(1))}
          style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.98 }] }]}>
          <T variant="heading" style={{ color: C.inverseInk }}>
            {last ? 'Continue' : 'Next'}
          </T>
          <Ionicons name="arrow-forward" size={16} color={C.inverseInk} />
        </Pressable>
      </View>
    </View>
  );
}

function WhatItIs() {
  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="phone-portrait-outline" size={26} color={C.ink} />
        </View>
        <T variant="title" style={{ textAlign: 'center' }}>A mobile client for Aside</T>
        <T variant="secondary" style={{ textAlign: 'center' }}>
          Aside is an AI browser that works on your computer, with your own logins and tabs. This
          app is a free, open source, unofficial client for it.
        </T>
      </View>
      <ExternalLink label="Learn about Aside" detail="aside.com" url={ASIDE_URL} icon="globe-outline" />
      <LegalBrief />
    </View>
  );
}

function HowItWorks() {
  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="git-network-outline" size={26} color={C.ink} />
        </View>
        <T variant="title" style={{ textAlign: 'center' }}>Continue sessions on your phone</T>
        <T variant="secondary" style={{ textAlign: 'center' }}>
          Your phone reaches Aside through a small bridge, installed on the computer that runs
          Aside. Run these two commands there:
        </T>
      </View>
      <CommandBlock lines={[BREW_INSTALL, BREW_START]} />
      <T variant="faint" style={{ textAlign: 'center' }}>
        A pairing code opens on that computer. Scan it on the next screen and you are set.
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: 300, opacity: 0.5 },
  skyFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  // No vertical centring: a ScrollView clips the top of content taller than the
  // screen when it centres, and the legal notice makes the first page tall.
  body: { flexGrow: 1, paddingHorizontal: S.xl, paddingTop: S.xxl, paddingBottom: S.xl },
  page: { gap: S.xl },
  hero: { alignItems: 'center', gap: S.sm },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.sm,
  },
  footer: { gap: S.lg, paddingHorizontal: S.xl, paddingTop: S.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.inkFaint, opacity: 0.5 },
  dotActive: { backgroundColor: C.ink, opacity: 1 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    backgroundColor: C.inverseBg,
    borderRadius: 999,
    paddingVertical: 14,
  },
});
