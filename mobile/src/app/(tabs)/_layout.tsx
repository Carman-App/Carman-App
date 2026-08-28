import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors, Radius, Shadow, Spacing } from '@/theme/tokens';

const TABS = [
  { name: 'garage', href: '/garage', label: 'Garage', glyph: 'garage' },
  { name: 'documents', href: '/documents', label: 'Documents', glyph: 'document' },
  { name: 'reminders', href: '/reminders', label: 'Reminders', glyph: 'reminder' },
  { name: 'insights', href: '/insights', label: 'Insights', glyph: 'insights' },
] as const;

export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <CarmaTabBar>
          {TABS.map((t) => (
            <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
              <TabButton glyph={t.glyph} label={t.label} />
            </TabTrigger>
          ))}
        </CarmaTabBar>
      </TabList>
    </Tabs>
  );
}

function CarmaTabBar({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>{children}</View>;
}

function TabButton({ glyph, label, isFocused, ...props }: TabTriggerSlotProps & { glyph: string; label: string }) {
  return (
    <Pressable {...props} style={styles.tabButton}>
      <IconGlyph glyph={glyph} size={26} bg="transparent" fg={isFocused ? Colors.accent : Colors.textFaint} />
      <T variant="meta" color={isFocused ? Colors.accent : Colors.textFaint} style={styles.label}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
    ...Shadow.card,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    borderRadius: Radius.md,
  },
  label: {
    fontSize: 11,
  },
});
