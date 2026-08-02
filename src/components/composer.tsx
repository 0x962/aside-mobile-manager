import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { C, F, S } from '@/constants/theme';
import type { Aside } from '@/lib/aside';
import { T } from './text';

type Attachment = { name: string; remotePath: string };

export function Composer({
  aside,
  placeholder,
  disabled,
  onSend,
  autoFocus,
  running = false,
  onStop,
}: {
  aside: Aside;
  placeholder: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onSend: (text: string) => void;
  running?: boolean;
  onStop?: () => void;
}) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canSend = !disabled && (text.trim().length > 0 || attachments.length > 0) && !uploading;
  const showStop = running && !canSend;

  const send = () => {
    if (!canSend) return;
    let message = text.trim();
    if (attachments.length) {
      const list = attachments.map((a) => `- ${a.name}: ${a.remotePath}`).join('\n');
      message = `${message}\n\nAttached files on this machine:\n${list}`.trim();
    }
    setText('');
    setAttachments([]);
    onSend(message);
  };

  const attach = async () => {
    setUploadError(null);
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    setUploading(true);
    try {
      const name = asset.name ?? asset.uri.split('/').pop() ?? 'file';
      const remotePath = await aside.uploadFile(name, await new File(asset.uri).base64());
      setAttachments((a) => [...a, { name, remotePath }]);
    } catch (e) {
      setUploadError(`Upload failed: ${String(e instanceof Error ? e.message : e).slice(0, 120)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {uploadError && <T variant="faint" style={{ color: C.error }}>{uploadError}</T>}
      {attachments.length > 0 && (
        <View style={styles.chips}>
          {attachments.map((a) => (
            <Pressable
              key={a.remotePath}
              onPress={() => setAttachments((list) => list.filter((x) => x !== a))}
              style={styles.chip}>
              <Ionicons name="document-outline" size={12} color={C.inkSecondary} />
              <T variant="label" numberOfLines={1} style={{ maxWidth: 160 }}>
                {a.name}
              </T>
              <Ionicons name="close" size={12} color={C.inkFaint} />
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.bar}>
        <Pressable onPress={attach} hitSlop={8} style={styles.attach}>
          {uploading ? (
            <ActivityIndicator size="small" color={C.inkSecondary} />
          ) : (
            <Ionicons name="add" size={22} color={C.inkSecondary} />
          )}
        </Pressable>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={C.inkFaint}
          multiline
          autoFocus={autoFocus}
          keyboardAppearance="dark"
        />
        {showStop ? (
          <Pressable onPress={onStop} hitSlop={8} style={[styles.send, styles.stop]}>
            <Ionicons name="stop" size={15} color={C.ink} />
          </Pressable>
        ) : (
          <Pressable onPress={send} hitSlop={8} style={[styles.send, !canSend && styles.sendDisabled]}>
            <Ionicons name="arrow-up" size={18} color={canSend ? C.inverseInk : C.inkFaint} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: S.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surfaceRaised,
    borderRadius: 999,
    paddingHorizontal: S.md,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: S.sm,
    backgroundColor: C.surface,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  attach: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    fontFamily: F.regular,
    fontSize: 16,
    lineHeight: 21,
    color: C.ink,
    maxHeight: 130,
    paddingTop: 9,
    paddingBottom: 9,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.inverseBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: C.surfaceRaised },
  stop: {
    backgroundColor: C.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
  },
});
