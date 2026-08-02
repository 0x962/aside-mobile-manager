import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Composer } from '@/components/composer';
import { ModelSheet } from '@/components/model-sheet';
import { T } from '@/components/text';
import { PendingStatus, renderDisplayItem } from '@/components/transcript';
import { C, prettyModel, S } from '@/constants/theme';
import { Aside, groupTranscript, type TranscriptItem } from '@/lib/aside';
import { ensureWarm, startRun, stopRun, useRuns } from '@/lib/runs';
import { useSettings } from '@/lib/settings';

export default function SessionScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { settings } = useSettings();
  const aside = useMemo(() => new Aside(settings), [settings]);
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<TranscriptItem[] | null>(null);
  const [meta, setMeta] = useState<{ title: string; modelId?: string; thinkingLevel?: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  // Sent messages render immediately; the CLI takes ~2s to record them in the
  // transcript, and the poll adds up to 1.5s more.
  const [pending, setPending] = useState<{ text: string; ts: number }[]>([]);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const runs = useRuns();
  const run = runs.find((r) => r.sessionId === id) ?? null;
  const running = run?.running ?? false;

  const load = useCallback(async () => {
    try {
      setItems(await aside.transcript(id));
      setLoadError(null);
    } catch (e) {
      setLoadError(String(e instanceof Error ? e.message : e));
    }
  }, [aside, id]);

  useEffect(() => {
    aside.sessionMeta(id).then(setMeta).catch(() => {});
    ensureWarm(aside, id);
  }, [aside, id]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(), running ? 1500 : 5000);
    return () => clearInterval(timer);
  }, [load, running]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const send = useCallback(
    (text: string) => {
      setSendError(null);
      setPending((p) => [...p, { text, ts: Date.now() }]);
      startRun(aside, { sessionId: id, text })
        .then(() => load())
        .catch((e) => {
          setPending((p) => p.filter((x) => x.text !== text));
          setSendError(String(e instanceof Error ? e.message : e).slice(0, 160));
        });
    },
    [aside, id, load],
  );

  // Prune pending entries once the transcript contains them.
  useEffect(() => {
    if (!items) return;
    setPending((p) => p.filter((x) => !items.some((i) => i.kind === 'user' && i.text === x.text)));
  }, [items]);

  const reversed = useMemo(() => {
    const grouped = items ? groupTranscript(items, running) : [];
    const visiblePending = pending
      .filter((x) => !items?.some((i) => i.kind === 'user' && i.text === x.text))
      .map((x) => ({ kind: 'user' as const, text: x.text, ts: x.ts }));
    return [...grouped, ...visiblePending].reverse();
  }, [items, running, pending]);
  const headerTitle = meta?.title || title || '';
  const subtitle = prettyModel(meta?.modelId);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={C.ink} />
        </Pressable>
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={{ flex: 1, alignItems: 'center', gap: 1 }}
          hitSlop={6}>
          <T variant="heading" numberOfLines={1}>
            {headerTitle}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <T variant="faint" numberOfLines={1}>
              {subtitle}
              {meta?.thinkingLevel ? ` · thinking ${meta.thinkingLevel}` : ''}
            </T>
            <Ionicons name="chevron-down" size={11} color={C.inkFaint} />
          </View>
        </Pressable>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <View style={{ flex: 1 }}>
          <FlatList
            inverted
            data={reversed}
            keyExtractor={(_, i) => String(reversed.length - i)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <>{renderDisplayItem(item, 0, send)}</>}
            ListEmptyComponent={
              items === null ? (
                <View style={styles.loading}>
                  {[0.25, 0.4, 0.6, 0.8].map((o, i) => (
                    <View
                      key={i}
                      style={[styles.skeleton, { opacity: o, alignSelf: i % 2 ? 'flex-end' : 'flex-start' }]}
                    />
                  ))}
                </View>
              ) : null
            }
            ListHeaderComponent={
              <View style={styles.head}>
                {run && running && <PendingStatus ticker={run.ticker} />}
                {run && !running && run.error && (
                  <View style={styles.errorRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                      <Ionicons name="alert-circle-outline" size={15} color={C.error} />
                      <T variant="label" style={{ color: C.error }}>Turn failed</T>
                    </View>
                    <T variant="faint" numberOfLines={3}>{run.error}</T>
                    <Pressable onPress={() => send(run.text)} style={styles.retryButton}>
                      <Ionicons name="refresh" size={13} color={C.ink} />
                      <T variant="label" style={{ color: C.ink }}>Retry</T>
                    </Pressable>
                  </View>
                )}
                {sendError && <T variant="faint" style={{ color: C.error }}>Send failed: {sendError}</T>}
                {loadError && <T variant="faint">Transcript unavailable: {loadError.slice(0, 100)}</T>}
              </View>
            }
          />
          <LinearGradient
            colors={[C.bg, 'rgba(0,0,0,0)']}
            style={styles.topFade}
            pointerEvents="none"
          />
        </View>
        <View style={[styles.composer, { paddingBottom: keyboardOpen ? S.sm : Math.max(insets.bottom, S.md) }]}>
          <Composer
            aside={aside}
            placeholder="Message Aside…"
            onSend={send}
            running={running}
            onStop={run ? () => stopRun(aside, run) : undefined}
          />
        </View>
      </KeyboardAvoidingView>

      <ModelSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        aside={aside}
        model={null}
        effort={null}
        onModel={() => {}}
        onEffort={() => {}}
        defaultModelName={subtitle}
        mode="session"
        onStartNewChat={(m) => {
          setSheetOpen(false);
          router.push({
            pathname: '/new',
            params: { provider: m.provider, providerName: m.providerName, modelId: m.modelId, modelName: m.name },
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.sm,
    paddingVertical: S.sm,
    gap: S.sm,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.xl + 8, gap: S.md },
  head: { gap: S.md, paddingBottom: S.sm },
  loading: { gap: S.md, paddingTop: S.lg, transform: [{ scaleY: -1 }] },
  skeleton: { height: 44, width: '70%', borderRadius: S.radius - 4, backgroundColor: C.surface },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 28 },
  composer: {
    paddingHorizontal: S.lg,
    paddingTop: S.sm,
    gap: S.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  errorRow: {
    gap: 6,
    backgroundColor: C.surface,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(248,113,113,0.4)',
    padding: S.md,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: C.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: S.md,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
  },
});
