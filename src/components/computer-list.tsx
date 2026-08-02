import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { PairingScreen } from '@/components/pairing';
import { T } from '@/components/text';
import { C, S } from '@/constants/theme';
import { firstReachable } from '@/lib/discovery';
import { PAIR_AGAIN } from '@/lib/links';
import { useSettings, withPairing, type Computer } from '@/lib/settings';

/**
 * The computers this phone has paired with, and the way to add one. Pairing
 * is the only way in: a code carries both the token and the addresses, so
 * nothing has to be discovered or typed. Both the connect screen and Settings
 * render this, so there is one implementation.
 */
export function ComputerList({
  onPair,
  onConnected,
  onForget,
}: {
  onPair: () => void;
  onConnected?: () => void;
  // Settings offers Forget on each row; the connect screen does not.
  onForget?: (name: string) => void;
}) {
  const { settings, update } = useSettings();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = async (computer: Computer) => {
    setConnecting(computer.name);
    setError(null);
    // Addresses change and phones move; take whichever one answers now.
    const address = await firstReachable(computer.addresses);
    setConnecting(null);
    if (!address) {
      setError(`${computer.name} did not answer. Check that it is awake and on this network.`);
      return;
    }
    update({ bridgeHost: address });
    onConnected?.();
  };

  return (
    <View style={styles.section}>
      {settings.computers.map((computer) => {
        const active = computer.addresses.includes(settings.bridgeHost);
        return (
          <Pressable
            key={computer.name}
            style={[styles.row, active && styles.rowActive]}
            onPress={() => connect(computer)}>
            <Ionicons name="desktop-outline" size={17} color={C.inkSecondary} />
            <View style={{ flex: 1 }}>
              <T variant="body">{computer.name}</T>
              <T variant="faint">
                {active ? `connected · ${settings.bridgeHost}` : 'tap to switch'}
              </T>
            </View>
            {connecting === computer.name ? (
              <ActivityIndicator size="small" color={C.inkSecondary} />
            ) : (
              <>
                {onForget && (
                  <Pressable onPress={() => onForget(computer.name)} hitSlop={10}>
                    <T variant="label" style={{ color: C.error }}>Forget</T>
                  </Pressable>
                )}
                {active ? (
                  <Ionicons name="checkmark" size={17} color={C.ink} />
                ) : (
                  <Ionicons name="swap-horizontal" size={16} color={C.inkFaint} />
                )}
              </>
            )}
          </Pressable>
        );
      })}
      {error && <T variant="faint" style={{ color: C.error }}>{error}</T>}

      <Pressable
        onPress={onPair}
        style={({ pressed }) => [styles.pairButton, pressed && { transform: [{ scale: 0.98 }] }]}>
        <Ionicons name="qr-code-outline" size={17} color={C.inverseInk} />
        <T variant="heading" style={{ color: C.inverseInk }}>
          {settings.computers.length ? 'Pair another computer' : 'Pair a computer'}
        </T>
      </Pressable>
      <T variant="faint" style={{ textAlign: 'center' }}>
        The computer shows a code when the bridge starts. Run {PAIR_AGAIN} to show it again.
      </T>
    </View>
  );
}

export function PairingFlow({ onClose }: { onClose: () => void }) {
  const { settings, update } = useSettings();
  return (
    <PairingScreen
      onCancel={onClose}
      onPaired={(pairing) => {
        update(withPairing(settings, pairing));
        onClose();
      }}
    />
  );
}

const styles = StyleSheet.create({
  section: { gap: S.sm },
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
  rowActive: { borderColor: C.borderStrong, backgroundColor: C.surfaceRaised },
  pairButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    backgroundColor: C.inverseBg,
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: S.sm,
  },
});
