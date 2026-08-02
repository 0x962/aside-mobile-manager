import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/components/text';
import { C, S } from '@/constants/theme';

export const ASIDE_URL = 'https://aside.com/';

type Page = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  points: { icon: keyof typeof Ionicons.glyphMap; text: string }[];
  link?: { label: string; url: string };
};

const PAGES: Page[] = [
  {
    icon: 'phone-portrait-outline',
    title: 'A phone remote for Aside',
    body: 'Aside is an agent that works in a browser on your computer, with your own logins and tabs. This app is a thin mobile interface for it: open source and free.',
    points: [
      { icon: 'list-outline', text: 'Read every session and transcript.' },
      { icon: 'send-outline', text: 'Start a session, or reply to one.' },
      { icon: 'eye-outline', text: 'Watch a turn as it works.' },
    ],
    link: { label: 'Install Aside to get started', url: ASIDE_URL },
  },
  {
    icon: 'git-network-outline',
    title: 'Control Aside remotely',
    body: 'Your computer runs a small service called the bridge. This app sends commands to it over your own network. Nothing passes through a server of ours.',
    points: [
      { icon: 'download-outline', text: 'Install the bridge on the computer that runs Aside.' },
      { icon: 'wifi-outline', text: 'Keep both devices on the same network.' },
      { icon: 'search-outline', text: 'Scan finds the bridge and connects.' },
    ],
  },
];

export function IntroScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const p = PAGES[page];
  const last = page === PAGES.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Image
        source={require('../../assets/images/aside-clouds.png')}
        style={styles.sky}
        contentFit="cover"
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)', C.bg]}
        style={styles.skyFade}
        pointerEvents="none"
      />
      <View style={[styles.body, { paddingBottom: insets.bottom + S.lg }]}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name={p.icon} size={26} color={C.ink} />
          </View>
          <T variant="title" style={{ textAlign: 'center' }}>{p.title}</T>
          <T variant="secondary" style={{ textAlign: 'center' }}>{p.body}</T>
        </View>

        <View style={styles.points}>
          {p.points.map((point) => (
            <View key={point.text} style={styles.point}>
              <Ionicons name={point.icon} size={16} color={C.inkSecondary} />
              <T variant="body" style={{ flex: 1 }}>{point.text}</T>
            </View>
          ))}
          {p.link && (
            <Pressable onPress={() => Linking.openURL(p.link!.url)} style={styles.link}>
              <Ionicons name="open-outline" size={15} color={C.ink} />
              <T variant="label" style={{ color: C.ink, flex: 1 }}>{p.link.label}</T>
              <T variant="faint">aside.com</T>
            </Pressable>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {PAGES.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
          <Pressable
            onPress={() => (last ? onDone() : setPage(page + 1))}
            style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.98 }] }]}>
            <T variant="heading" style={{ color: C.inverseInk }}>{last ? 'Get started' : 'Next'}</T>
            <Ionicons name="arrow-forward" size={16} color={C.inverseInk} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: 300, opacity: 0.5 },
  skyFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  body: { flex: 1, paddingHorizontal: S.xl, justifyContent: 'center', gap: S.xxl },
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
  points: { gap: S.md },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surface,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: S.md,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surfaceRaised,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    padding: S.md,
  },
  footer: { gap: S.lg, marginTop: 'auto' },
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
