import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/components/text';
import { C, S } from '@/constants/theme';
import { DEMO_HOST } from '@/lib/demo';
import { reachableBridge, scanTailnet, tailnetInfo, type TailnetHost, type TailnetInfo } from '@/lib/discovery';
import { useSettings } from '@/lib/settings';

// The screen shown while no bridge host is configured: on first launch and
// after leaving demo mode. The machine listing comes from a bridge, so the
// scan probes known hosts first; with none reachable it can only report why.
export function ConnectScreen() {
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  const [scanning, setScanning] = useState(true);
  const [found, setFound] = useState<TailnetHost[]>([]);
  const [net, setNet] = useState<TailnetInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    setNotice(null);
    try {
      const [info, via] = await Promise.all([
        tailnetInfo(),
        reachableBridge(settings.hosts.map((h) => h.host)),
      ]);
      setNet(info);
      if (!via) {
        setFound([]);
        setNotice(
          info
            ? 'No bridge answered. Install the bridge on the machine that runs Aside, then scan again.'
            : 'Tailscale is not active on this phone. Connect to your network, then scan again.',
        );
        return;
      }
      const machines = (await scanTailnet(via)).filter((m) => m.online);
      setFound(machines);
      if (!machines.some((m) => m.hasBridge))
        setNotice('No bridge found on the network. Install it on the machine that runs Aside.');
    } catch (e) {
      setNotice(String(e instanceof Error ? e.message : e).slice(0, 160));
    } finally {
      setScanning(false);
    }
  }, [settings.hosts]);

  useEffect(() => {
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (host: string, name: string) => {
    const rest = settings.hosts.filter((h) => h.host !== host);
    update({ bridgeHost: host, hosts: [{ name, host }, ...rest] });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
          <View style={styles.heroIcon}>
            <Ionicons name="git-network-outline" size={26} color={C.ink} />
          </View>
          <T variant="title">Connect to Aside</T>
          <T variant="secondary" style={{ textAlign: 'center' }}>
            Aside runs on your computer. This app starts{'\n'}and steers its sessions over your network.
          </T>
        </View>

        <View style={styles.section}>
          {found.map((m) => (
            <Pressable
              key={m.host}
              style={[styles.hostRow, !m.hasBridge && { opacity: 0.55 }]}
              disabled={!m.hasBridge}
              onPress={() => choose(m.host, m.name)}>
              <View style={[styles.dot, m.hasBridge && { backgroundColor: C.running }]} />
              <View style={{ flex: 1 }}>
                <T variant="body">{m.name}</T>
                <T variant="faint">
                  {m.host}
                  {m.os ? ` · ${m.os}` : ''}
                  {m.hasBridge ? '' : ' · no bridge'}
                </T>
              </View>
              {m.hasBridge && <Ionicons name="chevron-forward" size={15} color={C.inkFaint} />}
            </Pressable>
          ))}
          {notice && <T variant="faint">{notice}</T>}
          <Pressable onPress={scan} disabled={scanning} style={styles.scanButton}>
            {scanning ? (
              <ActivityIndicator size="small" color={C.inverseInk} />
            ) : (
              <Ionicons name="search-outline" size={16} color={C.inverseInk} />
            )}
            <T variant="heading" style={{ color: C.inverseInk }}>
              {scanning ? 'Scanning network…' : 'Scan network'}
            </T>
          </Pressable>
          {net && (
            <T variant="faint" style={{ textAlign: 'center' }}>
              This phone is {net.deviceName ? `${net.deviceName} ` : ''}on {net.tailnet}.
            </T>
          )}
        </View>

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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingVertical: S.sm },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: S.xl, gap: S.xl, flexGrow: 1 },
  hero: { alignItems: 'center', gap: S.sm, paddingTop: S.xxl },
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
  section: { gap: S.sm },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surface,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: S.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.inkFaint },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    backgroundColor: C.inverseBg,
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: S.sm,
  },
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
