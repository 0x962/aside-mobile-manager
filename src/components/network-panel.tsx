import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { PairingScreen } from '@/components/pairing';
import { T } from '@/components/text';
import { C, S } from '@/constants/theme';
import { Bridge } from '@/lib/bridge';
import { overlayInfo, scanAll, type FoundHost, type NetworkInfo } from '@/lib/discovery';
import { useSettings } from '@/lib/settings';

/**
 * The one place machines are found and chosen. Both the connect screen and
 * Settings render this, so scanning, naming, and pairing behave identically.
 * Rendering the pairing screen is the caller's job, since each host lays it
 * out differently.
 */
export function NetworkPanel({
  onPair,
  onConnected,
}: {
  onPair: (target: { host: string; name: string }) => void;
  onConnected?: () => void;
}) {
  const { settings, update } = useSettings();
  const [scanning, setScanning] = useState(true);
  const [progress, setProgress] = useState(0);
  const [found, setFound] = useState<FoundHost[]>([]);
  const [net, setNet] = useState<NetworkInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    setProgress(0);
    setNotice(null);
    try {
      const [info, machines] = await Promise.all([
        overlayInfo(),
        scanAll(
          settings.hosts.map((h) => h.host),
          settings.tokens,
          (done, total) => setProgress(done / total),
        ),
      ]);
      setNet(info);
      const online = machines.filter((m) => m.online);
      setFound(online);
      if (!online.some((m) => m.hasBridge))
        setNotice(
          info
            ? 'No bridge answered. Check that the computer that runs Aside is awake and has the bridge installed.'
            : 'No bridge answered. Put this phone on the same network as the computer that runs Aside.',
        );
    } catch (e) {
      setNotice(String(e instanceof Error ? e.message : e).slice(0, 160));
    } finally {
      setScanning(false);
    }
  }, [settings.hosts, settings.tokens]);

  useEffect(() => {
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = async (host: string, name: string) => {
    const health = await new Bridge(host, settings.tokens[host]).health().catch(() => null);
    if (health?.authRequired && !health.paired) return onPair({ host, name });
    const rest = settings.hosts.filter((h) => h.host !== host);
    update({ bridgeHost: host, hosts: [{ name, host }, ...rest] });
    onConnected?.();
  };

  return (
    <View style={styles.section}>
      <ScanButton scanning={scanning} progress={progress} onPress={scan} />
      {found.map((m) => {
        const selected = settings.bridgeHost === m.host;
        return (
          <Pressable
            key={m.host}
            style={[styles.hostRow, selected && styles.hostRowActive, !m.hasBridge && { opacity: 0.55 }]}
            disabled={!m.hasBridge}
            onPress={() => choose(m.host, m.name)}>
            <View style={[styles.dot, m.hasBridge && { backgroundColor: C.running }]} />
            <View style={{ flex: 1 }}>
              <T variant="body">{m.name}</T>
              <T variant="faint">
                {m.host}
                {m.os ? ` · ${m.os}` : ''}
                {m.hasBridge ? '' : ' · no bridge'}
                {m.hasBridge && !settings.tokens[m.host] ? ' · not paired' : ''}
              </T>
            </View>
            {selected ? (
              <Ionicons name="checkmark" size={17} color={C.ink} />
            ) : (
              m.hasBridge && <Ionicons name="chevron-forward" size={15} color={C.inkFaint} />
            )}
          </Pressable>
        );
      })}
      {notice && <T variant="faint">{notice}</T>}
      {net && (
        <T variant="faint" style={{ textAlign: 'center' }}>
          This phone is {net.deviceName ? `${net.deviceName} ` : ''}on {net.name}.
        </T>
      )}
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

export function PairingFlow({
  target,
  onClose,
}: {
  target: { host: string; name: string };
  onClose: () => void;
}) {
  const { settings, update } = useSettings();
  return (
    <PairingScreen
      host={target.host}
      name={target.name}
      onCancel={onClose}
      onPaired={(token) => {
        const rest = settings.hosts.filter((h) => h.host !== target.host);
        update({
          bridgeHost: target.host,
          hosts: [{ name: target.name, host: target.host }, ...rest],
          tokens: { ...settings.tokens, [target.host]: token },
        });
        onClose();
      }}
    />
  );
}

const styles = StyleSheet.create({
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
  hostRowActive: { borderColor: C.borderStrong, backgroundColor: C.surfaceRaised },
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
});
