import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ModelSheet } from '@/components/model-sheet';
import { parseTicker } from '@/components/transcript';
import { T } from '@/components/text';
import { C, F, S } from '@/constants/theme';
import { Aside, type ModelOption } from '@/lib/aside';
import { startRun, stopRun, useRuns } from '@/lib/runs';
import { computerFor, useSettings } from '@/lib/settings';

const SUGGESTIONS = [
  'Summarize my open tabs',
  'Check my inbox for anything urgent',
  'What did my sessions do today?',
];

export default function NewSessionScreen() {
  const { settings } = useSettings();
  const aside = useMemo(() => new Aside(settings), [settings]);
  const insets = useSafeAreaInsets();
  const preset = useLocalSearchParams<{
    provider?: string;
    providerName?: string;
    modelId?: string;
    modelName?: string;
  }>();
  const [text, setText] = useState('');
  const [model, setModel] = useState<ModelOption | null>(
    preset.modelId && preset.provider
      ? {
          provider: preset.provider,
          providerName: preset.providerName ?? preset.provider,
          modelId: preset.modelId,
          name: preset.modelName ?? preset.modelId,
        }
      : null,
  );
  const [effort, setEffort] = useState<string | null>(null);
  const [runKey, setRunKey] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // This screen presents as an iOS sheet modal, where KeyboardAvoidingView
  // measures against the wrong origin. The sheet reaches the screen bottom,
  // so the exact overlap is the keyboard height itself.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const runs = useRuns();
  const run = runKey ? runs.find((r) => r.key === runKey) ?? null : null;

  // As soon as the CLI registers the session, jump into it.
  useEffect(() => {
    if (run?.sessionId) {
      router.replace({ pathname: '/session/[id]', params: { id: run.sessionId } });
    }
  }, [run?.sessionId]);

  const busy = starting || !!run;

  const start = async () => {
    if (!text.trim() || busy) return;
    setStartError(null);
    setStarting(true);
    try {
      const r = await startRun(aside, { sessionId: null, text: text.trim(), model, effort });
      setRunKey(r.key);
    } catch (e) {
      setStartError(String(e instanceof Error ? e.message : e).slice(0, 200));
    } finally {
      setStarting(false);
    }
  };

  const cancel = () => {
    if (run?.running) stopRun(aside, run);
    setRunKey(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconButton}>
          <Ionicons name="close" size={20} color={C.inkSecondary} />
        </Pressable>
        <T variant="heading" style={{ flex: 1, textAlign: 'center' }}>New session</T>
        <View style={styles.iconButton} />
      </View>

      <View style={{ flex: 1, paddingBottom: keyboardHeight }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled">
          <TextInput
            ref={inputRef}
            style={styles.prompt}
            value={text}
            onChangeText={setText}
            placeholder="What should Aside do?"
            placeholderTextColor={C.inkFaint}
            multiline
            autoFocus
            editable={!busy}
            keyboardAppearance="dark"
          />
          {!text.trim() && !busy && (
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.suggestion} onPress={() => setText(s)}>
                  <Ionicons name="sparkles-outline" size={13} color={C.inkSecondary} />
                  <T variant="secondary">{s}</T>
                </Pressable>
              ))}
            </View>
          )}
          <T variant="faint">
            Runs in Aside on {computerFor(settings, settings.bridgeHost)?.name ?? 'your computer'},
            with your logged-in accounts and open tabs.
          </T>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: keyboardHeight > 0 ? S.md : Math.max(insets.bottom, S.lg) }]}>
          {startError && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={15} color={C.error} />
              <T variant="faint" style={{ color: C.error, flex: 1 }}>{startError}</T>
            </View>
          )}
          {run && (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={C.inkSecondary} />
              <T variant="secondary" style={{ flex: 1 }} numberOfLines={1}>
                {run.sessionId ? 'Opening session…' : run.error ?? parseTicker(run.ticker).label}
              </T>
              <Pressable onPress={cancel} hitSlop={8}>
                <T variant="label" style={{ color: C.ink }}>Cancel</T>
              </Pressable>
            </View>
          )}
          <Pressable onPress={() => setSheetOpen(true)} style={styles.modelChip}>
            <Ionicons name="hardware-chip-outline" size={14} color={C.inkSecondary} />
            <T variant="label" style={{ color: C.ink }}>
              {model ? model.name : 'Default model'}
              {effort ? ` · thinking ${effort}` : ''}
            </T>
            <Ionicons name="chevron-down" size={12} color={C.inkFaint} />
          </Pressable>
          <Pressable
            onPress={start}
            disabled={!text.trim() || busy}
            style={[styles.startButton, (!text.trim() || busy) && styles.startDisabled]}>
            {busy ? (
              <ActivityIndicator size="small" color={C.inverseInk} />
            ) : (
              <Ionicons name="arrow-up" size={18} color={text.trim() ? C.inverseInk : C.inkFaint} />
            )}
            <T variant="heading" style={{ color: text.trim() && !busy ? C.inverseInk : C.inkFaint }}>
              Start session
            </T>
          </Pressable>
        </View>
      </View>

      <ModelSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        aside={aside}
        model={model}
        effort={effort}
        onModel={setModel}
        onEffort={setEffort}
        defaultModelName="Default model"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, paddingTop: S.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.sm,
    paddingVertical: S.sm,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { padding: S.xl, gap: S.xl },
  prompt: {
    fontFamily: F.regular,
    fontSize: 22,
    lineHeight: 30,
    color: C.ink,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  suggestions: { gap: S.sm },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    alignSelf: 'flex-start',
    backgroundColor: C.surface,
    borderRadius: 999,
    paddingHorizontal: S.lg,
    paddingVertical: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  footer: {
    paddingHorizontal: S.lg,
    paddingTop: S.md,
    gap: S.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surface,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    paddingHorizontal: S.md,
    paddingVertical: 10,
  },
  modelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: C.surface,
    borderRadius: 999,
    paddingHorizontal: S.md,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    backgroundColor: C.inverseBg,
    borderRadius: 999,
    paddingVertical: 14,
  },
  startDisabled: { backgroundColor: C.surfaceRaised },
});
