import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { T } from '@/components/text';
import { C, F, S } from '@/constants/theme';
import {
  LICENSE_URL,
  REPO_URL,
  SUPPORT_EMAIL,
  TRADEMARK_NOTICE,
  WARRANTY_NOTICE,
} from '@/lib/links';

/** A link that leaves the app: every one of these opens the default browser. */
export function ExternalLink({
  label,
  detail,
  url,
  icon = 'open-outline',
}: {
  label: string;
  detail?: string;
  url: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} style={styles.link}>
      <Ionicons name={icon} size={16} color={C.inkSecondary} />
      <View style={{ flex: 1 }}>
        <T variant="body">{label}</T>
        {detail && <T variant="faint">{detail}</T>}
      </View>
      <Ionicons name="chevron-forward" size={15} color={C.inkFaint} />
    </Pressable>
  );
}

/** A short notice for the intro; the full one lives in Settings. */
export function LegalBrief() {
  return (
    <T variant="faint" style={styles.brief}>
      Unofficial and not affiliated with Aside. Free and open source, provided as is.
    </T>
  );
}

export function LegalSection() {
  return (
    <View style={{ gap: S.sm }}>
      <T variant="label">About and legal</T>
      <ExternalLink label="Source code" detail={REPO_URL.replace('https://', '')} url={REPO_URL} icon="logo-github" />
      <ExternalLink label="MIT license" detail="Free and open source" url={LICENSE_URL} icon="document-text-outline" />
      <ExternalLink
        label="Support"
        detail={SUPPORT_EMAIL}
        url={`mailto:${SUPPORT_EMAIL}`}
        icon="mail-outline"
      />
      <View style={styles.notice}>
        <T variant="faint">{TRADEMARK_NOTICE}</T>
        <T variant="faint">{WARRANTY_NOTICE}</T>
      </View>
    </View>
  );
}

/** The commands that put the bridge on the computer. */
export function CommandBlock({ lines }: { lines: string[] }) {
  return (
    <View style={styles.commands}>
      {lines.map((line) => (
        <T key={line} style={styles.command}>
          {line}
        </T>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surface,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    padding: S.md,
  },
  brief: { textAlign: 'center', paddingHorizontal: S.md },
  notice: { gap: S.sm, paddingTop: S.xs },
  commands: {
    backgroundColor: C.surfaceRaised,
    borderRadius: S.radiusSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    paddingHorizontal: S.md,
    paddingVertical: S.md,
    gap: 6,
  },
  command: { fontFamily: F.mono, fontSize: 13, lineHeight: 19, color: C.ink },
});
