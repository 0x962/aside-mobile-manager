import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DisplayItem, TranscriptItem } from '@/lib/aside';
import { C, F, S } from '@/constants/theme';
import { Markdown } from './markdown';
import { T } from './text';

export function UserBubble({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={styles.userRow}>
      <Pressable onLongPress={onRetry} style={styles.userBubble}>
        <Markdown text={text} inverse />
      </Pressable>
    </View>
  );
}

export function AssistantText({ text }: { text: string }) {
  return (
    <View style={styles.assistantRow}>
      <Markdown text={text} />
    </View>
  );
}

export function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const summary = text.trim().split('\n')[0];
  return (
    <Pressable onPress={() => setOpen((v) => !v)} style={styles.thinking}>
      <Ionicons name="sparkles-outline" size={12} color={C.inkFaint} style={{ marginTop: 3 }} />
      <T variant="faint" style={[styles.thinkingText, { flex: 1 }]} numberOfLines={open ? undefined : 1}>
        {open ? text.trim() : summary}
      </T>
    </Pressable>
  );
}

const TOOL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  repl: 'code-slash-outline',
  gmail: 'mail-outline',
  notify: 'notifications-outline',
};

export function ToolRow({ item }: { item: Extract<TranscriptItem, { kind: 'tool' }> }) {
  const [open, setOpen] = useState(false);
  const label = item.title || item.name;
  const icon = TOOL_ICONS[item.name] ?? 'construct-outline';
  return (
    <Pressable onPress={() => setOpen((v) => !v)} style={styles.tool}>
      <View style={styles.toolHeader}>
        <Ionicons name={item.isError ? 'alert-circle-outline' : icon} size={14} color={item.isError ? C.error : C.inkSecondary} />
        <T variant="label" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </T>
        {item.elapsedMs !== null && (
          <T variant="faint">
            {item.elapsedMs >= 1000 ? `${(item.elapsedMs / 1000).toFixed(1)}s` : `${Math.round(item.elapsedMs)}ms`}
          </T>
        )}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={C.inkFaint} />
      </View>
      {open && (
        <View style={styles.toolBody}>
          <Text style={styles.toolMono} numberOfLines={40}>{item.args}</Text>
          {item.result !== '' && (
            <Text style={[styles.toolMono, item.isError && { color: C.error }]} numberOfLines={40}>
              {item.result}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

export function SystemRow({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((v) => !v)} style={styles.system}>
      <T variant="faint" numberOfLines={open ? undefined : 1}>
        {label.replace(/_/g, ' ')} · {text.trim().split('\n')[0]}
        {open ? `\n\n${text.trim()}` : ''}
      </T>
    </Pressable>
  );
}

// The raw PTY line is terminal output; translate it before showing it.
export function parseTicker(ticker: string): { label: string; detail: string } {
  if (/^Thinking\b/i.test(ticker)) return { label: 'Thinking…', detail: ticker.replace(/^Thinking:?\s*/i, '') };
  if (/^Starting/i.test(ticker)) return { label: 'Starting…', detail: '' };
  return { label: 'Working…', detail: ticker };
}

// The assistant's pending reply: a shimmering line in the conversation at the
// spot the reply will fill. Content replaces it; it never persists.
export function PendingStatus({ ticker }: { ticker: string }) {
  const shimmer = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);
  return (
    <Animated.View style={{ opacity: shimmer, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons name="sparkles-outline" size={13} color={C.inkSecondary} />
      <T variant="secondary">{parseTicker(ticker).label}</T>
    </Animated.View>
  );
}


function formatElapsed(ms: number): string {
  if (ms < 1000) return '';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export function TraceRow({ trace }: { trace: Extract<DisplayItem, { kind: 'trace' }> }) {
  const [open, setOpen] = useState(false);
  const elapsed = formatElapsed(trace.elapsedMs);
  const label =
    trace.toolCount > 0
      ? `Worked · ${trace.steps.length} step${trace.steps.length === 1 ? '' : 's'}${elapsed ? ` · ${elapsed}` : ''}`
      : 'Thought';
  return (
    <View>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.traceHeader}>
        <Ionicons name="sparkles-outline" size={12} color={C.inkFaint} />
        <T variant="faint">{label}</T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color={C.inkFaint} />
      </Pressable>
      {open && (
        <View style={styles.traceBody}>
          {trace.steps.map((step, i) => {
            if (step.kind === 'thinking') return <ThinkingBlock key={i} text={step.text} />;
            if (step.kind === 'tool') return <ToolRow key={i} item={step} />;
            if (step.kind === 'system') return <SystemRow key={i} label={step.label} text={step.text} />;
            return null;
          })}
        </View>
      )}
    </View>
  );
}

export function renderDisplayItem(item: DisplayItem, index: number, onRetry?: (text: string) => void) {
  switch (item.kind) {
    case 'user':
      return <UserBubble key={index} text={item.text} onRetry={onRetry ? () => onRetry(item.text) : undefined} />;
    case 'text':
      return <AssistantText key={index} text={item.text} />;
    case 'trace':
      return <TraceRow key={index} trace={item} />;
  }
}

const styles = StyleSheet.create({
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingLeft: 56 },
  userBubble: {
    backgroundColor: C.inverseBg,
    borderRadius: S.radius,
    borderBottomRightRadius: 6,
    paddingHorizontal: S.lg,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  assistantRow: { paddingRight: S.md },
  thinking: {
    flexDirection: 'row',
    gap: S.sm,
    borderLeftWidth: 2,
    borderLeftColor: C.border,
    paddingLeft: S.md,
    paddingVertical: 2,
  },
  thinkingText: { fontStyle: 'italic' },
  tool: {
    backgroundColor: C.surface,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    paddingHorizontal: S.md,
    paddingVertical: 10,
    gap: S.sm,
  },
  toolHeader: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  toolBody: { gap: S.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingTop: S.sm },
  toolMono: { fontFamily: F.mono, fontSize: 11.5, lineHeight: 16, color: C.inkSecondary },
  system: { paddingVertical: 2, opacity: 0.8 },
  traceHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  traceBody: { gap: S.sm, paddingTop: S.sm },
});
