import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ComputerList, PairingFlow } from '@/components/computer-list';
import { T } from '@/components/text';
import { C, F, S } from '@/constants/theme';
import { Aside } from '@/lib/aside';
import { DEMO_HOST } from '@/lib/demo';
import { useSettings } from '@/lib/settings';

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const aside = useMemo(() => new Aside(settings), [settings]);
  const [check, setCheck] = useState<string | null>(null);
  const [pairing, setPairing] = useState(false);

  const test = async () => {
    setCheck('Checking…');
    try {
      const health = await aside.bridge.health();
      await aside.ready();
      const version = (await aside.bridge.out([aside.bin, '-V'])).trim();
      setCheck(`Bridge ok (${health.procs} procs) · aside ${version}`);
    } catch (e) {
      setCheck(`Failed: ${String(e instanceof Error ? e.message : e).slice(0, 160)}`);
    }
  };

  const forget = (name: string) => {
    const gone = settings.computers.find((c) => c.name === name);
    update({
      computers: settings.computers.filter((c) => c.name !== name),
      ...(gone?.addresses.includes(settings.bridgeHost) ? { bridgeHost: '' } : {}),
    });
  };

  if (pairing) return <PairingFlow onClose={() => setPairing(false)} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerButton}>
          <Ionicons name="close" size={20} color={C.inkSecondary} />
        </Pressable>
        <T variant="heading" style={{ flex: 1, textAlign: 'center' }}>Settings</T>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.section}>
        <T variant="label">Computer</T>
        <ComputerList onPair={() => setPairing(true)} onConnected={() => router.back()} />
      </View>

      {settings.bridgeHost === DEMO_HOST && (
        <Pressable style={styles.row} onPress={() => update({ bridgeHost: '' })}>
          <Ionicons name="flask-outline" size={16} color={C.inkSecondary} />
          <T variant="body" style={{ flex: 1 }}>Demo mode is on</T>
          <T variant="label" style={{ color: C.ink }}>Exit</T>
        </Pressable>
      )}

      {settings.computers.length > 0 && (
        <View style={styles.section}>
          <T variant="label">Paired computers</T>
          {settings.computers.map((c) => (
            <View key={c.name} style={styles.row}>
              <Ionicons name="lock-closed-outline" size={14} color={C.inkSecondary} />
              <View style={{ flex: 1 }}>
                <T variant="body">{c.name}</T>
                <T variant="faint">{c.addresses.join(' · ')}</T>
              </View>
              <Pressable onPress={() => forget(c.name)} hitSlop={10}>
                <T variant="label" style={{ color: C.error }}>Forget</T>
              </Pressable>
            </View>
          ))}
          <T variant="faint">
            Forget drops the key from this phone. To revoke this phone on the computer, delete its
            entry in ~/.minibridge/state.json there.
          </T>
        </View>
      )}

      <Field
        label="Aside binary"
        value={settings.asideBin}
        placeholder="auto · ~/.local/bin/aside on the bridge machine"
        onChange={(v) => update({ asideBin: v.trim() })}
      />
      <Field
        label="Aside home"
        value={settings.asideHome}
        placeholder="auto · ~/.aside on the bridge machine"
        onChange={(v) => update({ asideHome: v.trim() })}
      />

      <Pressable style={styles.button} onPress={test}>
        <T variant="heading" style={{ color: C.inverseInk }}>Test connection</T>
      </Pressable>
      {check && <T variant="secondary">{check}</T>}

      <Pressable onPress={() => update({ introSeen: false })} style={styles.link}>
        <T variant="label" style={{ color: C.inkSecondary }}>Show the introduction again</T>
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  return (
    <View style={styles.section}>
      <T variant="label">{label}</T>
      <TextInput
        style={styles.input}
        value={local}
        onChangeText={setLocal}
        onEndEditing={() => onChange(local)}
        placeholder={placeholder}
        placeholderTextColor={C.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardAppearance="dark"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: S.xl, paddingTop: S.md, gap: S.xl, paddingBottom: 64 },
  header: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -S.md },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
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
  input: {
    backgroundColor: C.surface,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    paddingHorizontal: S.md,
    paddingVertical: S.md,
    fontFamily: F.mono,
    fontSize: 14,
    color: C.ink,
  },
  button: {
    backgroundColor: C.inverseBg,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: S.md,
  },
  link: { alignSelf: 'center', paddingVertical: S.sm },
});
