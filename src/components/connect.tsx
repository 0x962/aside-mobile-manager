import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PairingScreen } from '@/components/pairing';
import { T } from '@/components/text';
import { C, S } from '@/constants/theme';
import { Bridge } from '@/lib/bridge';
import { DEMO_HOST } from '@/lib/demo';
import { overlayInfo, scanAll, type FoundHost, type NetworkInfo } from '@/lib/discovery';
import { useSettings } from '@/lib/settings';

// The screen shown while no bridge host is configured: on first launch and
// after leaving demo mode. The scan sweeps this phone's own subnet, which
// needs no prior knowledge, and any bridge it reaches also reports the
// machines on the wider network.
export function ConnectScreen() {
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  const [scanning, setScanning] = useState(true);
  const [progress, setProgress] = useState(0);
  const [found, setFound] = useState<FoundHost[]>([]);
  const [net, setNet] = useState<NetworkInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pairing, setPairing] = useState<{ host: string; name: string } | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    setProgress(0);
    setNotice(null);
    try {
      const [info, machines] = await Promise.all([
        overlayInfo(),
        scanAll(
          settings.hosts.map((h) => h.host),
          (done, total) => setProgress(done / total),
        ),
      ]);
      setNet(info);
      const online = machines.filter((m) => m.online);
      setFound(online);
      if (!online.some((m) => m.hasBridge))
        setNotice('No bridge found. Install it on the computer that runs Aside, then scan again.');
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

  const connect = (host: string, name: string, token?: string) => {
    const rest = settings.hosts.filter((h) => h.host !== host);
    update({
      bridgeHost: host,
      hosts: [{ name, host }, ...rest],
      ...(token ? { tokens: { ...settings.tokens, [host]: token } } : {}),
    });
  };

  // A host that wants a token sends the phone to pairing first.
  const choose = async (host: string, name: string) => {
    const token = settings.tokens[host];
    const health = await new Bridge(host, token).health().catch(() => null);
    if (health?.authRequired && !health.paired) setPairing({ host, name });
    else connect(host, name);
  };

  if (pairing)
    return (
      <PairingScreen
        host={pairing.host}
        name={pairing.name}
        onCancel={() => setPairing(null)}
        onPaired={(token) => {
          const { host, name } = pairing;
          setPairing(null);
          connect(host, name, token);
        }}
      />
    );

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

        <View style={styles.section}>
          <ScanButton scanning={scanning} progress={progress} onPress={scan} />
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
          {net && (
            <T variant="faint" style={{ textAlign: 'center' }}>
              This phone is {net.deviceName ? `${net.deviceName} ` : ''}on {net.name}.
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

// The scan button keeps its size and place through every state; while a scan
// runs, a light band sweeps across it and the spinner replaces the icon.
function ScanButton({
  scanning,
  progress,
  onPress,
}: {
  scanning: boolean;
  progress: number;
  onPress: () => void;
}) {
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!scanning) return;
    sweep.setValue(0);
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [scanning, sweep]);

  return (
    <Pressable
      onPress={onPress}
      disabled={scanning}
      style={({ pressed }) => [styles.scanButton, pressed && { transform: [{ scale: 0.98 }] }]}>
      {scanning && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sweep,
            { transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-280, 280] }) }] },
          ]}>
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
      {scanning ? (
        <ActivityIndicator size="small" color={C.inverseInk} />
      ) : (
        <Ionicons name="search-outline" size={16} color={C.inverseInk} />
      )}
      <T variant="heading" style={{ color: C.inverseInk }}>
        {scanning ? `Scanning network… ${Math.round(progress * 100)}%` : 'Scan network'}
      </T>
    </Pressable>
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
    marginBottom: S.sm,
    overflow: 'hidden',
  },
  sweep: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 180 },
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
