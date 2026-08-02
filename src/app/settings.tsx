import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { T } from '@/components/text';
import { C, F, S } from '@/constants/theme';
import { Aside } from '@/lib/aside';
import { DEMO_HOST } from '@/lib/demo';
import { probe, reachableBridge, scanTailnet } from '@/lib/discovery';
import { useSettings, type BridgeHost } from '@/lib/settings';

type HostRow = BridgeHost & { os?: string; status: 'checking' | 'ok' | 'down' };

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const aside = useMemo(() => new Aside(settings), [settings]);
  const [rows, setRows] = useState<HostRow[]>(
    settings.hosts.map((h) => ({ ...h, status: 'checking' })),
  );
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [newHost, setNewHost] = useState('');
  const [check, setCheck] = useState<string | null>(null);

  const refreshStatuses = useCallback((list: HostRow[]) => {
    setRows(list);
    for (const row of list) {
      probe(row.host).then((ok) =>
        setRows((prev) => prev.map((r) => (r.host === row.host ? { ...r, status: ok ? 'ok' : 'down' } : r))),
      );
    }
  }, []);

  useEffect(() => {
    refreshStatuses(settings.hosts.map((h) => ({ ...h, status: 'checking' as const })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      // The demo bridge would report a fictional tailnet; scan only real hosts.
      const seeds = [settings.bridgeHost, ...settings.hosts.map((h) => h.host)].filter(
        (h) => h && h !== DEMO_HOST,
      );
      const via = await reachableBridge(seeds);
      if (!via) {
        setScanError('No bridge reachable to scan from. Add one host manually first.');
        return;
      }
      const found = await scanTailnet(via);
      const merged: HostRow[] = found.map((f) => ({
        name: f.name,
        host: f.host,
        os: f.os,
        status: f.hasBridge ? 'ok' : 'down',
      }));
      // Keep manually added hosts that the scan did not report.
      for (const h of settings.hosts) {
        if (!merged.some((m) => m.host === h.host)) merged.push({ ...h, status: 'checking' });
      }
      update({ hosts: merged.map(({ name, host }) => ({ name, host })) });
      refreshStatuses(merged);
    } catch (e) {
      setScanError(String(e instanceof Error ? e.message : e).slice(0, 160));
    } finally {
      setScanning(false);
    }
  };

  const addHost = () => {
    const host = newHost.trim().includes(':') ? newHost.trim() : `${newHost.trim()}:4720`;
    if (!newHost.trim()) return;
    setNewHost('');
    const next = [...settings.hosts, { name: host.split(':')[0], host }];
    update({ hosts: next, bridgeHost: host });
    refreshStatuses(next.map((h) => ({ ...h, status: 'checking' as const })));
  };

  const removeHost = (host: string) => {
    const next = settings.hosts.filter((h) => h.host !== host);
    update({ hosts: next });
    setRows((prev) => prev.filter((r) => r.host !== host));
  };

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
        <View style={styles.rowBetween}>
          <T variant="label">Bridge host</T>
          <Pressable onPress={scan} hitSlop={8} style={styles.scanButton}>
            {scanning ? (
              <ActivityIndicator size="small" color={C.inkSecondary} />
            ) : (
              <T variant="label" style={{ color: C.ink }}>Scan tailnet</T>
            )}
          </Pressable>
        </View>
        {rows.map((row) => {
          const selected = settings.bridgeHost === row.host;
          const selectable = row.status === 'ok';
          return (
            <Pressable
              key={row.host}
              style={[styles.hostRow, selected && styles.hostRowActive, !selectable && { opacity: 0.55 }]}
              disabled={!selectable}
              onPress={() => update({ bridgeHost: row.host })}>
              <View
                style={[
                  styles.dot,
                  row.status === 'ok' && { backgroundColor: C.running },
                  row.status === 'down' && { backgroundColor: C.inkFaint },
                ]}
              />
              <View style={{ flex: 1 }}>
                <T variant="body">{row.name}</T>
                <T variant="faint">
                  {row.host}
                  {row.os ? ` · ${row.os}` : ''}
                  {row.status === 'down' ? ' · no bridge' : ''}
                  {row.status === 'checking' ? ' · checking…' : ''}
                </T>
              </View>
              {selected && <Ionicons name="checkmark" size={17} color={C.ink} />}
              {!selected && (
                <Pressable onPress={() => removeHost(row.host)} hitSlop={10}>
                  <Ionicons name="close" size={15} color={C.inkFaint} />
                </Pressable>
              )}
            </Pressable>
          );
        })}
        {scanError && <T variant="faint" style={{ color: C.error }}>{scanError}</T>}
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={newHost}
            onChangeText={setNewHost}
            placeholder="add host, for example 100.x.y.z:4720"
            placeholderTextColor={C.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardAppearance="dark"
            onSubmitEditing={addHost}
          />
          <Pressable onPress={addHost} style={styles.addButton}>
            <Ionicons name="add" size={20} color={C.inverseInk} />
          </Pressable>
        </View>
        <T variant="faint">
          The scan asks a reachable bridge for tailnet machines, then probes port 4720 on each.
        </T>
      </View>

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
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scanButton: {
    backgroundColor: C.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: S.md,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    minWidth: 96,
    alignItems: 'center',
  },
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
  addRow: { flexDirection: 'row', gap: S.sm, alignItems: 'center' },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.inverseBg,
    alignItems: 'center',
    justifyContent: 'center',
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
});
