import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, S } from '@/constants/theme';
import type { Account } from '@/lib/aside';
import { T } from './text';

export function Avatar({ name, size = 38 }: { name?: string; size?: number }) {
  const initial = name?.trim().charAt(0).toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {initial ? (
        <T style={{ fontFamily: F.semibold, fontSize: size * 0.42, color: C.ink }}>{initial}</T>
      ) : (
        <Ionicons name="person-outline" size={size * 0.45} color={C.inkSecondary} />
      )}
    </View>
  );
}

export function ProfileMenu({
  visible,
  onClose,
  accounts,
  activeId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  accounts: Account[];
  activeId: number;
  onSelect: (id: number) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, S.lg) }]}>
        <View style={styles.grabber} />
        <View style={styles.headerRow}>
          <T variant="heading">Profiles</T>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={C.inkSecondary} />
          </Pressable>
        </View>

        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: S.lg }}>
          <View style={styles.group}>
            {accounts.map((a, i) => (
              <Pressable
                key={a.id}
                onPress={() => {
                  onSelect(a.id);
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.row,
                  i < accounts.length - 1 && styles.rowDivider,
                  pressed && { backgroundColor: C.surfacePressed },
                ]}>
                <Avatar name={a.name} size={32} />
                <View style={{ flex: 1 }}>
                  <T variant="body">{a.name}</T>
                  <T variant="faint">{a.email ?? 'local'} · {a.authStatus}</T>
                </View>
                {a.id === activeId && <Ionicons name="checkmark" size={18} color={C.ink} />}
              </Pressable>
            ))}
            {accounts.length === 0 && (
              <View style={styles.row}>
                <T variant="faint">Accounts load from the bridge.</T>
              </View>
            )}
          </View>

          <View style={styles.group}>
            <Pressable
              onPress={() => {
                onClose();
                router.push('/settings');
              }}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.surfacePressed }]}>
              <View style={styles.settingsIcon}>
                <Ionicons name="settings-outline" size={16} color={C.inkSecondary} />
              </View>
              <T variant="body" style={{ flex: 1 }}>Settings</T>
              <Ionicons name="chevron-forward" size={15} color={C.inkFaint} />
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: C.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    paddingVertical: 12,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  settingsIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
