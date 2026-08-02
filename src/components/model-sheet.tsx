import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, S } from '@/constants/theme';
import { EFFORTS, type Aside, type ModelOption } from '@/lib/aside';
import { T } from './text';

// Aside fixes a chat's model and thinking level when the chat starts; the CLI
// ignores overrides on continued sessions. mode 'new' picks for the chat being
// created; mode 'session' shows the locked config and launches a new chat.
export function ModelSheet({
  visible,
  onClose,
  aside,
  model,
  effort,
  onModel,
  onEffort,
  defaultModelName,
  mode = 'new',
  onStartNewChat,
}: {
  visible: boolean;
  onClose: () => void;
  aside: Aside;
  model: ModelOption | null;
  effort: string | null;
  onModel: (m: ModelOption | null) => void;
  onEffort: (e: string | null) => void;
  defaultModelName: string;
  mode?: 'new' | 'session';
  onStartNewChat?: (m: ModelOption) => void;
}) {
  const insets = useSafeAreaInsets();
  const [models, setModels] = useState<ModelOption[]>([]);

  useEffect(() => {
    if (visible) aside.models().then(setModels).catch(() => setModels([]));
  }, [aside, visible]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ModelOption[]>();
    for (const m of models) {
      if (!groups.has(m.providerName)) groups.set(m.providerName, []);
      groups.get(m.providerName)!.push(m);
    }
    return [...groups.entries()];
  }, [models]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, S.lg) }]}>
        <View style={styles.grabber} />
        <View style={styles.headerRow}>
          <T variant="heading">{mode === 'new' ? 'Model for this chat' : 'Chat model'}</T>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={C.inkSecondary} />
          </Pressable>
        </View>

        {mode === 'session' && (
          <View style={styles.lockNote}>
            <Ionicons name="lock-closed-outline" size={13} color={C.inkSecondary} />
            <T variant="secondary" style={{ flex: 1 }}>
              This chat runs on {defaultModelName}. Aside fixes the model when a chat starts. Pick a
              model below to start a new chat with it.
            </T>
          </View>
        )}

        <ScrollView style={styles.scroll} contentContainerStyle={{ gap: S.lg }}>
          {mode === 'new' && (
            <View style={styles.group}>
              <Row
                label={defaultModelName}
                sub="Aside default"
                selected={model === null}
                onPress={() => onModel(null)}
              />
            </View>
          )}
          {grouped.map(([provider, list]) => (
            <View key={provider} style={{ gap: S.sm }}>
              <T variant="label" style={{ paddingHorizontal: S.xs }}>{provider}</T>
              <View style={styles.group}>
                {list.map((m, i) => (
                  <Row
                    key={`${m.provider}/${m.modelId}`}
                    label={m.name}
                    sub={mode === 'session' ? 'Start a new chat' : undefined}
                    selected={mode === 'new' && model?.provider === m.provider && model?.modelId === m.modelId}
                    onPress={() => (mode === 'new' ? onModel(m) : onStartNewChat?.(m))}
                    divider={i < list.length - 1}
                  />
                ))}
              </View>
            </View>
          ))}

          {mode === 'new' && (
            <View style={{ gap: S.sm }}>
              <T variant="label" style={{ paddingHorizontal: S.xs }}>Thinking</T>
              <View style={styles.effortWrap}>
                <EffortChip label="default" selected={effort === null} onPress={() => onEffort(null)} />
                {EFFORTS.map((e) => (
                  <EffortChip key={e} label={e} selected={effort === e} onPress={() => onEffort(e)} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <Pressable onPress={onClose} style={styles.done}>
          <T variant="heading" style={{ color: C.inverseInk }}>Done</T>
        </Pressable>
      </View>
    </Modal>
  );
}

function Row({
  label,
  sub,
  selected,
  onPress,
  divider,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && styles.rowDivider, pressed && { backgroundColor: C.surfacePressed }]}>
      <View style={{ flex: 1 }}>
        <T variant="body">{label}</T>
        {sub ? <T variant="faint">{sub}</T> : null}
      </View>
      {selected && <Ionicons name="checkmark" size={18} color={C.ink} />}
    </Pressable>
  );
}

function EffortChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.effortChip, selected && styles.effortChipActive]}>
      <T variant="label" style={selected ? { color: C.inverseInk } : undefined}>{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: C.overlay },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: S.lg,
    maxHeight: '80%',
    gap: S.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.borderStrong,
    marginTop: S.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: S.sm,
    backgroundColor: C.surfaceRaised,
    borderRadius: S.radiusSm,
    padding: S.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  scroll: { flexGrow: 0 },
  group: {
    backgroundColor: C.surfaceRaised,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    paddingHorizontal: S.lg,
    paddingVertical: 13,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  effortWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  effortChip: {
    backgroundColor: C.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: S.md,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  effortChipActive: { backgroundColor: C.inverseBg, borderColor: C.inverseBg },
  done: {
    backgroundColor: C.inverseBg,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 13,
  },
});
