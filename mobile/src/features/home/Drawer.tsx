import { router } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Dot } from '@/components/ui/Blocks';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

export type DrawerItem = {
  label: string;
  meta?: string;
  glyph: string;
  hue: string;
  tint: string;
  dot?: boolean;
  href: string;
};

type DrawerProps = {
  visible: boolean;
  onClose: () => void;
  name: string;
  items: DrawerItem[];
  recents: string[];
  onRecent: (q: string) => void;
  onNewChat: () => void;
  switchLabel: string;
  onSwitch: () => void;
};

/**
 * The left drawer opened from the avatar on Home: the places Home doesn't
 * hold (Garage, Documents, Reminders and notifications, Members), Recents,
 * a profile switch and New chat.
 */
export function Drawer({ visible, onClose, name, items, recents, onRecent, onNewChat, switchLabel, onSwitch }: DrawerProps) {
  const insets = useSafeAreaInsets();
  const go = (href: string) => {
    onClose();
    router.push(href as never);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.panel, { paddingTop: insets.top + Spacing.sm, paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <View style={styles.head}>
            <T style={styles.brand}>Carma</T>
            <Pressable onPress={() => go('/settings')} accessibilityLabel="My profile">
              <Avatar name={name} size={40} />
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.nav}>
              {items.map((n) => (
                <Pressable key={n.label} onPress={() => go(n.href)} style={({ pressed }) => [styles.navRow, pressed && styles.navPressed]}>
                  <IconGlyph glyph={n.glyph} size={32} shape="tile" bg={n.tint} fg={n.hue} />
                  <T style={styles.navLabel} numberOfLines={1}>
                    {n.label}
                  </T>
                  {n.meta ? (
                    <T variant="meta" color={Colors.accent}>
                      {n.meta}
                    </T>
                  ) : null}
                  {n.dot ? <Dot /> : null}
                </Pressable>
              ))}
            </View>
            <T variant="small" style={styles.recentsHead}>
              Recents
            </T>
            {recents.length === 0 ? (
              <T variant="meta" color={Colors.textFaint} style={styles.recentEmpty}>
                Questions you ask on Home show up here.
              </T>
            ) : (
              recents.map((r, i) => (
                <Pressable
                  key={r}
                  onPress={() => {
                    onClose();
                    onRecent(r);
                  }}
                  style={styles.recent}>
                  <T numberOfLines={1} style={[styles.recentText, { color: i < 5 ? Colors.ink : Colors.textMuted }]}>
                    {r}
                  </T>
                </Pressable>
              ))
            )}
          </ScrollView>
          <View style={styles.foot}>
            <Pressable onPress={onSwitch} accessibilityLabel={switchLabel} style={styles.switch}>
              <Avatar name={switchLabel} size={44} bg={Colors.ink} color={Colors.white} />
            </Pressable>
            <Pressable
              onPress={() => {
                onClose();
                onNewChat();
              }}
              style={({ pressed }) => [styles.newChat, pressed && { backgroundColor: Colors.ctaPressed }]}>
              <IconGlyph glyph="add" size={22} bg="transparent" fg={Colors.ink} scale={0.9} />
              <T style={styles.newChatLabel}>New chat</T>
            </Pressable>
          </View>
        </View>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close menu" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(20,22,26,0.34)',
  },
  panel: {
    width: 300,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: Spacing.md,
  },
  brand: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: Colors.ink,
  },
  scroll: {
    flex: 1,
  },
  nav: {
    gap: 2,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  navPressed: {
    backgroundColor: 'rgba(20,22,26,0.05)',
  },
  navLabel: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.ink,
  },
  recentsHead: {
    paddingHorizontal: 4,
    paddingTop: Spacing.md,
    paddingBottom: 6,
  },
  recentEmpty: {
    paddingHorizontal: 4,
  },
  recent: {
    paddingHorizontal: 4,
    paddingVertical: 9,
  },
  recentText: {
    fontSize: 14,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: Spacing.sm,
  },
  switch: {
    borderRadius: 22,
  },
  newChat: {
    flex: 1,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cta,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  newChatLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: Colors.ink,
  },
});
