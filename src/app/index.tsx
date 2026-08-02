import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConnectScreen } from '@/components/connect';
import { IntroScreen } from '@/components/intro';
import { Avatar, ProfileMenu } from '@/components/profile-menu';
import { T } from '@/components/text';
import { C, F, prettyModel, S } from '@/constants/theme';
import { Aside, type Account, type SessionRow } from '@/lib/aside';
import { DEMO_HOST } from '@/lib/demo';
import { useRuns } from '@/lib/runs';
import { useSettings } from '@/lib/settings';
import { greeting, timeAgo } from '@/lib/time';

function sectionFor(ts: number): string {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startOfDay) return 'Today';
  if (ts >= startOfDay - 86400000) return 'Yesterday';
  if (ts >= startOfDay - 6 * 86400000) return 'This week';
  return 'Earlier';
}

export default function SessionsScreen() {
  const { settings, update } = useSettings();
  const aside = useMemo(() => new Aside(settings), [settings]);
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const runs = useRuns();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const configured = settings.bridgeHost !== '';

  const load = useCallback(async () => {
    if (!configured) return;
    try {
      setSessions(await aside.listSessions());
      setError(null);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, [aside, configured]);

  useFocusEffect(
    useCallback(() => {
      load();
      timer.current = setInterval(load, 5000);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }, [load]),
  );

  useFocusEffect(
    useCallback(() => {
      aside.accounts().then(setAccounts).catch(() => setAccounts([]));
    }, [aside]),
  );

  const activeAccount = accounts.find((a) => a.id === settings.account);
  // The bridge says "not paired" when its token is missing or was revoked.
  const needsPairing = /not paired/i.test(error ?? '');

  const activeIds = new Set(runs.filter((r) => r.running).map((r) => r.sessionId));

  const sections = useMemo(() => {
    if (!sessions) return [];
    const buckets = new Map<string, SessionRow[]>();
    for (const s of sessions) {
      const k = sectionFor(s.updatedAt);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(s);
    }
    return ['Today', 'Yesterday', 'This week', 'Earlier']
      .filter((k) => buckets.has(k))
      .map((k) => ({ title: k, data: buckets.get(k)! }));
  }, [sessions]);

  const hostName = settings.hosts.find((h) => h.host === settings.bridgeHost)?.name ?? settings.bridgeHost;

  if (!settings.introSeen) return <IntroScreen onDone={() => update({ introSeen: true })} />;
  if (!configured) return <ConnectScreen />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <T variant="title">{greeting()}</T>
          {settings.bridgeHost !== DEMO_HOST && <T variant="secondary">{hostName}</T>}
        </View>
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={8}
          style={({ pressed }) => pressed && { opacity: 0.7 }}>
          <Avatar name={activeAccount?.name} />
        </Pressable>
      </View>

      <ProfileMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        accounts={accounts}
        activeId={settings.account}
        onSelect={(id) => {
          if (id === settings.account) return;
          setSessions(null);
          update({ account: id });
        }}
      />

      {error && (
        <Pressable
          style={styles.errorCard}
          onPress={() => (needsPairing ? update({ bridgeHost: '' }) : router.push('/settings'))}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
            <Ionicons
              name={needsPairing ? 'lock-closed-outline' : 'cloud-offline-outline'}
              size={16}
              color={C.error}
            />
            <T variant="label" style={{ color: C.error }}>
              {needsPairing ? 'Pairing needed' : 'Bridge unreachable'}
            </T>
          </View>
          <T variant="faint">
            {settings.bridgeHost} · {needsPairing ? 'tap to pair again' : 'tap to open settings'}
          </T>
        </Pressable>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(s) => s.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={C.inkSecondary}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        renderSectionHeader={({ section }) => (
          <T variant="label" style={styles.sectionHeader}>
            {section.title}
          </T>
        )}
        ListEmptyComponent={
          sessions === null ? (
            <View style={styles.skeletons}>
              {[0.9, 0.7, 0.5, 0.35, 0.25].map((o, i) => (
                <View key={i} style={[styles.skeleton, { opacity: o }]} />
              ))}
            </View>
          ) : !error ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={40} color={C.inkFaint} />
              <T variant="heading">No sessions yet</T>
              <T variant="secondary" style={{ textAlign: 'center' }}>
                Start one and Aside runs it on your computer,{'\n'}with your accounts and open tabs.
              </T>
            </View>
          ) : null
        }
        renderItem={({ item, index, section }) => {
          // The status column can stay "running" after a crash; trust it only
          // while the session is fresh, or when this app itself has a live turn.
          const active =
            activeIds.has(item.id) ||
            (item.status !== 'idle' && Date.now() - item.updatedAt < 120000);
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                first && styles.rowFirst,
                last && styles.rowLast,
                !last && styles.rowDivider,
                pressed && { backgroundColor: C.surfacePressed },
              ]}
              onPress={() =>
                router.push({ pathname: '/session/[id]', params: { id: item.id, title: item.title } })
              }>
              {active && <View style={styles.dotActive} />}
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="heading" numberOfLines={1}>{item.title}</T>
                <T variant="faint" numberOfLines={1}>
                  {active ? 'Running · ' : ''}
                  {prettyModel(item.model?.modelId)} · {timeAgo(item.updatedAt)}
                </T>
              </View>
              <Ionicons name="chevron-forward" size={15} color={C.inkFaint} />
            </Pressable>
          );
        }}
      />

      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.92)', C.bg]}
        style={[styles.scrim, { height: insets.bottom + 110 }]}
        pointerEvents="none"
      />
      <View style={[styles.fabWrap, { bottom: Math.max(insets.bottom - 2, S.md) }]} pointerEvents="box-none">
        <Pressable
          onPress={() => router.push('/new')}
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.97 }] }]}>
          <Ionicons name="add" size={20} color={C.inverseInk} />
          <T variant="heading" style={{ color: C.inverseInk }}>New session</T>
        </Pressable>
      </View>
      {settings.bridgeHost === DEMO_HOST && (
        <Pressable
          onPress={() => update({ bridgeHost: '' })}
          hitSlop={12}
          style={[styles.demoChip, { bottom: Math.max(insets.bottom, S.md) + 4 }]}>
          <Text style={styles.demoChipText}>DEMO</Text>
          <Ionicons name="close" size={12} color="#C084FC" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.xl,
    paddingTop: S.md,
    paddingBottom: S.sm,
    gap: S.md,
  },
  list: { paddingHorizontal: S.lg, paddingTop: S.sm },
  sectionHeader: { paddingHorizontal: S.sm, paddingTop: S.lg, paddingBottom: S.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surface,
    paddingHorizontal: S.lg,
    paddingVertical: 14,
  },
  rowFirst: { borderTopLeftRadius: S.radius - 4, borderTopRightRadius: S.radius - 4 },
  rowLast: { borderBottomLeftRadius: S.radius - 4, borderBottomRightRadius: S.radius - 4 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  dotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.running },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  skeletons: { gap: S.sm, paddingTop: S.lg },
  skeleton: { height: 68, borderRadius: S.radius - 4, backgroundColor: C.surface },
  empty: { alignItems: 'center', gap: S.sm, paddingTop: 120 },
  errorCard: {
    marginHorizontal: S.lg,
    marginTop: S.sm,
    padding: S.lg,
    gap: 4,
    backgroundColor: C.surface,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(248,113,113,0.4)',
  },
  fabWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  demoChip: {
    position: 'absolute',
    right: S.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: S.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(88,28,135,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(192,132,252,0.5)',
  },
  demoChipText: { color: '#C084FC', fontFamily: F.bold, fontSize: 11, letterSpacing: 2 },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.inverseBg,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
