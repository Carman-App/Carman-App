import { StyleSheet, View } from 'react-native';

import { Footnote, ScreenTitle } from '@/components/ui/Blocks';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { TopBar } from '@/components/ui/TopBar';
import { Spacing } from '@/theme/tokens';

type PlaceholderScreenProps = {
  title: string;
  section?: string;
  note?: string;
};

/**
 * Screens that have a route but not a design yet (billing, inspections,
 * the workshop plan...). Same chrome as everything else, and says plainly
 * that the screen is still to come.
 */
export function PlaceholderScreen({ title, section, note }: PlaceholderScreenProps) {
  return (
    <Screen header={<TopBar backLabel="BACK" right={section} />}>
      <View style={styles.icon}>
        <IconGlyph glyph="soon" size={56} shape="tile" />
      </View>
      <ScreenTitle title={title} lede={note ?? 'This part of Carma is still being built. Everything you record elsewhere keeps working in the meantime.'} />
      <Footnote>IT WILL APPEAR HERE IN AN UPDATE. NOTHING YOU NEED IS HIDDEN BEHIND IT.</Footnote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: {
    paddingTop: Spacing.xxl,
  },
});
