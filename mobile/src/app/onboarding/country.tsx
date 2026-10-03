import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { PickerSheet } from '@/components/ui/PickerSheet';
import { T } from '@/components/ui/Typography';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { COUNTRIES } from '@/features/onboarding/countries';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';
import { REGION_UNITS, type Region } from '@/types/domain';

/** "KES · KILOMETRES · LITRES", as the design lists each country. */
function unitsLine(region: Region): string {
  const u = REGION_UNITS[region];
  return `${u.currency} · ${u.distance === 'km' ? 'KILOMETRES' : 'MILES'} · ${u.volume === 'L' ? 'LITRES' : 'GALLONS'}`;
}

/** Country. One pill opens a searchable sheet. The choice sets currency, distance and volume. */
export default function CountryScreen() {
  const { draft, update } = useOnboardingDraft();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(false);
  const country = COUNTRIES.find((c) => c.region === draft.region);
  const label = (c: (typeof COUNTRIES)[number]) => `${c.flag}  ${c.name}`;

  return (
    <OnboardingScreen
      backLabel="WELCOME"
      step={{ step: 1, total: 6 }}
      title="Where are you based?"
      lede="Sets your currency and units."
      footer={
        <Button disabled={!picked} onPress={() => router.push('/onboarding/profile')}>
          Continue
        </Button>
      }>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.pill, pressed && { borderColor: Colors.lineStrong }]}>
        <T numberOfLines={1} style={[styles.name, { color: picked ? Colors.body : Colors.textMuted }]}>
          {picked && country ? label(country) : 'Choose a country'}
        </T>
        <IconGlyph glyph="chevron-down" size={50} fg={Colors.accent} scale={0.4} />
      </Pressable>
      {picked ? (
        <T variant="eyebrow" color={Colors.textFaint} style={styles.summary}>
          {unitsLine(draft.region)}
        </T>
      ) : null}
      <View />
      <PickerSheet
        visible={open}
        title="Pick a country"
        searchPlaceholder="Country or currency"
        items={COUNTRIES.map(label)}
        itemMeta={Object.fromEntries(COUNTRIES.map((c) => [label(c), unitsLine(c.region)]))}
        emptyHint="TRY A CURRENCY CODE LIKE KES OR EUR."
        selected={country && picked ? label(country) : undefined}
        onSelect={(v) => {
          const c = COUNTRIES.find((x) => label(x) === v);
          if (c) update({ region: c.region, unit: REGION_UNITS[c.region].distance === 'mi' ? 'mi' : 'km' });
          setPicked(true);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 64,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radius.pill,
    paddingLeft: Spacing.lg,
    paddingRight: 6,
  },
  name: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 14,
  },
  summary: {
    marginTop: 18,
    paddingLeft: 4,
  },
});
