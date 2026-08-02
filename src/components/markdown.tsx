import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, F, S } from '@/constants/theme';

// Minimal markdown: paragraphs, headings, lists, fenced code, inline
// bold/italic/code/links. Covers what Aside's replies actually use without a
// heavyweight renderer in the transcript's hot path.

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; level: number; text: string }
  | { type: 'li'; ordered: boolean; index: number; text: string; level: number }
  | { type: 'code'; text: string }
  | { type: 'hr' }
  | { type: 'table'; rows: string[][] };

const splitRow = (line: string) =>
  line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

const isSeparatorRow = (line: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');

function toBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split('\n');
  let i = 0;
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') });
    para = [];
  };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      flush();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', text: buf.join('\n') });
      continue;
    }
    if (line.trim().startsWith('|')) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!isSeparatorRow(lines[i])) rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', rows });
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      flush();
      blocks.push({ type: 'h', level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    const ul = line.match(/^(\s*)[-*]\s+(.*)/);
    const ol = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (ul || ol) {
      flush();
      const indent = (ul ? ul[1] : ol![1]).length;
      const level = Math.min(3, Math.floor(indent / 2));
      blocks.push(
        ul
          ? { type: 'li', ordered: false, index: 0, text: ul[2], level }
          : { type: 'li', ordered: true, index: Number(ol![2]), text: ol![3], level },
      );
      i++;
      continue;
    }
    if (!line.trim()) flush();
    else para.push(line.trim());
    i++;
  }
  flush();
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|!?\[[^\]]+\]\([^)]+\))/g;

function Inline({ text, base }: { text: string; base?: object }) {
  const parts = text.split(INLINE);
  return (
    <Text style={[styles.body, base]}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <Text key={i} style={styles.bold}>{part.slice(2, -2)}</Text>;
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
          return <Text key={i} style={styles.italic}>{part.slice(1, -1)}</Text>;
        if (part.startsWith('`') && part.endsWith('`'))
          return <Text key={i} style={styles.inlineCode}>{part.slice(1, -1)}</Text>;
        const link = part.match(/^!?\[([^\]]+)\]\(([^)]+)\)$/);
        if (link)
          return (
            <Text key={i} style={styles.link} onPress={() => Linking.openURL(link[2])}>
              {link[1]}
            </Text>
          );
        return part;
      })}
    </Text>
  );
}

export function Markdown({ text, inverse = false }: { text: string; inverse?: boolean }) {
  const base = inverse ? { color: C.inverseInk } : undefined;
  return (
    <View style={styles.container}>
      {toBlocks(text).map((b, i) => {
        if (b.type === 'hr') return <View key={i} style={styles.hr} />;
        if (b.type === 'table')
          return (
            <ScrollView key={i} horizontal style={styles.tableWrap} showsHorizontalScrollIndicator={false}>
              <View>
                {b.rows.map((row, r) => (
                  <View key={r} style={[styles.tr, r === 0 && styles.trHead]}>
                    {row.map((cell, c) => (
                      <View key={c} style={styles.td}>
                        <Inline text={cell} base={r === 0 ? styles.th : styles.tdText} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          );
        if (b.type === 'code')
          return (
            <View key={i} style={styles.codeBlock}>
              <Text style={styles.code}>{b.text}</Text>
            </View>
          );
        if (b.type === 'h')
          return <Inline key={i} text={b.text} base={{ ...styles.heading, ...(base ?? {}) }} />;
        if (b.type === 'li')
          return (
            <View key={i} style={[styles.li, { paddingLeft: S.xs + b.level * 18 }]}>
              <Text style={[styles.bullet, base]}>{b.ordered ? `${b.index}.` : '•'}</Text>
              <View style={{ flex: 1 }}>
                <Inline text={b.text} base={base} />
              </View>
            </View>
          );
        return <Inline key={i} text={b.text} base={base} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: S.sm },
  body: { fontFamily: F.regular, fontSize: 16, lineHeight: 23.5, color: C.ink },
  heading: { fontFamily: F.semibold, fontSize: 17, lineHeight: 24, marginTop: S.xs },
  bold: { fontFamily: F.semibold },
  italic: { fontStyle: 'italic' },
  inlineCode: { fontFamily: F.mono, fontSize: 14, backgroundColor: 'rgba(255,255,255,0.09)', color: C.ink },
  link: { textDecorationLine: 'underline' },
  li: { flexDirection: 'row', gap: S.sm },
  bullet: { fontFamily: F.regular, fontSize: 16, lineHeight: 23.5, color: C.inkSecondary, minWidth: 16 },
  codeBlock: {
    backgroundColor: C.surface,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: S.md,
  },
  code: { fontFamily: F.mono, fontSize: 12.5, lineHeight: 18, color: C.ink },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: C.borderStrong, marginVertical: S.xs },
  tableWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    borderRadius: S.radiusSm,
    backgroundColor: C.surface,
  },
  tr: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  trHead: { borderTopWidth: 0, backgroundColor: 'rgba(255,255,255,0.04)' },
  td: { minWidth: 96, maxWidth: 200, paddingHorizontal: S.md, paddingVertical: S.sm },
  th: { fontFamily: F.semibold, fontSize: 13, lineHeight: 18, color: C.inkSecondary },
  tdText: { fontSize: 14, lineHeight: 20 },
});
