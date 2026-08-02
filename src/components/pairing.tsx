import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/components/text';
import { C, S } from '@/constants/theme';
import { Bridge } from '@/lib/bridge';
import { firstReachable } from '@/lib/discovery';

type Stage = 'scanning' | 'checking' | 'failed';

export type Pairing = { name: string; addresses: string[]; token: string; connected: string };

/**
 * Pair with a computer by scanning the code it shows on its own screen. The
 * code carries the token and every address the computer answers on, so only
 * someone who can see that screen gets access, and the phone needs to
 * discover nothing.
 */
export function PairingScreen({
  onPaired,
  onCancel,
}: {
  onPaired: (pairing: Pairing) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>('scanning');
  const [error, setError] = useState<string | null>(null);
  // A camera reports the same code many times a second; claim only the first.
  const claiming = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted) requestPermission();
  }, [permission, requestPermission]);

  const retry = () => {
    setError(null);
    claiming.current = false;
    setStage('scanning');
  };

  const onScan = async (data: string) => {
    if (claiming.current) return;
    let payload: { token?: string; host?: string; hosts?: string[] };
    try {
      payload = JSON.parse(data);
    } catch {
      return; // some other QR code in view
    }
    const token = typeof payload.token === 'string' ? payload.token : '';
    const addresses = payload.hosts ?? [];
    if (!token || !addresses.length) return;
    claiming.current = true;
    setStage('checking');
    try {
      const connected = await firstReachable(addresses, 2000);
      if (!connected) throw new Error('that computer is not reachable from this phone');
      await new Bridge(connected).claimPairing(token);
      onPaired({ name: payload.host || connected.split(':')[0], addresses, token, connected });
    } catch (e) {
      claiming.current = false;
      setError(String(e instanceof Error ? e.message : e).slice(0, 160));
      setStage('failed');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} hitSlop={10} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={22} color={C.ink} />
        </Pressable>
        <T variant="heading" style={{ flex: 1, textAlign: 'center' }}>Pair a computer</T>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.body}>
        <View style={styles.viewfinder}>
          {permission?.granted && stage === 'scanning' ? (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => onScan(data)}
              />
              <ScanFrame />
            </>
          ) : (
            <View style={styles.placeholder}>
              {stage === 'failed' ? (
                <Ionicons name="alert-circle-outline" size={32} color={C.error} />
              ) : (
                <ActivityIndicator size="small" color={C.inkSecondary} />
              )}
              <T variant="secondary" style={{ textAlign: 'center' }}>
                {stage === 'checking' && 'Connecting…'}
                {stage === 'failed' && (error ?? 'Pairing failed.')}
                {stage === 'scanning' && !permission?.granted && 'Camera access is needed to scan the code.'}
              </T>
            </View>
          )}
        </View>

        <View style={styles.steps}>
          <Step n="1" text="On the computer, run: npm run pair" />
          <Step n="2" text="Point this phone at the code on its screen." />
          <Step n="3" text="The code expires after 3 minutes." />
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + S.lg }]}>
          {stage === 'failed' && (
            <Pressable onPress={retry} style={styles.button}>
              <Ionicons name="refresh" size={16} color={C.inverseInk} />
              <T variant="heading" style={{ color: C.inverseInk }}>Try again</T>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepDot}>
        <T variant="label" style={{ color: C.inverseInk }}>{n}</T>
      </View>
      <T variant="body" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

function ScanFrame() {
  const line = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(line, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(line, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [line]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.corner, styles.tl]} />
      <View style={[styles.corner, styles.tr]} />
      <View style={[styles.corner, styles.bl]} />
      <View style={[styles.corner, styles.br]} />
      <Animated.View
        style={[
          styles.scanLine,
          { transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [12, 236] }) }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.sm, paddingVertical: S.sm },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: S.xl, gap: S.xl },
  viewfinder: {
    height: 260,
    borderRadius: S.radius,
    overflow: 'hidden',
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    marginTop: S.sm,
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md, padding: S.xl },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: C.ink },
  tl: { top: 14, left: 14, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 },
  tr: { top: 14, right: 14, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 6 },
  bl: { bottom: 14, left: 14, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 6 },
  br: { bottom: 14, right: 14, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 6 },
  scanLine: { position: 'absolute', left: 20, right: 20, height: 1.5, backgroundColor: 'rgba(255,255,255,0.7)' },
  steps: { gap: S.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.inverseBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { marginTop: 'auto', gap: S.md },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    backgroundColor: C.inverseBg,
    borderRadius: 999,
    paddingVertical: 14,
  },
  secondary: { alignSelf: 'center', paddingVertical: S.sm },
});
