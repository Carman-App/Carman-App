import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ListRow } from '@/components/ui/ListRow';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useConfigCountries } from '@/data/hooks';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { REGION_UNITS, type Region, type UnitSystem } from '@/types/domain';
import { Colors, Spacing } from '@/theme/tokens';

// Matches the prototype's COUNTRY screen exactly: Kenya first (the sensible
// default — all seed/demo data assumes Kenya), then the rest of the list in
// the same order the prototype shows them (grouped roughly by region).
//
// This hardcoded list stays the fallback AND the type system's source of
// truth for which 66 regions the rest of the app understands (routing,
// REGION_UNITS, the `Region` union in @/types/domain) — see the merge
// comment below for what does and doesn't become "live" once an admin
// publishes Country data.
const COUNTRIES: { region: Region; name: string; flag: string }[] = [
  { region: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { region: 'UG', name: 'Uganda', flag: '🇺🇬' },
  { region: 'TZ', name: 'Tanzania', flag: '🇹🇿' },
  { region: 'RW', name: 'Rwanda', flag: '🇷🇼' },
  { region: 'ET', name: 'Ethiopia', flag: '🇪🇹' },
  { region: 'SO', name: 'Somalia', flag: '🇸🇴' },
  { region: 'SS', name: 'South Sudan', flag: '🇸🇸' },
  { region: 'BI', name: 'Burundi', flag: '🇧🇮' },
  { region: 'CD', name: 'DR Congo', flag: '🇨🇩' },
  { region: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { region: 'ZM', name: 'Zambia', flag: '🇿🇲' },
  { region: 'ZW', name: 'Zimbabwe', flag: '🇿🇼' },
  { region: 'BW', name: 'Botswana', flag: '🇧🇼' },
  { region: 'NA', name: 'Namibia', flag: '🇳🇦' },
  { region: 'MZ', name: 'Mozambique', flag: '🇲🇿' },
  { region: 'MW', name: 'Malawi', flag: '🇲🇼' },
  { region: 'AO', name: 'Angola', flag: '🇦🇴' },
  { region: 'MU', name: 'Mauritius', flag: '🇲🇺' },
  { region: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { region: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { region: 'CI', name: 'Ivory Coast', flag: '🇨🇮' },
  { region: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { region: 'CM', name: 'Cameroon', flag: '🇨🇲' },
  { region: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { region: 'MA', name: 'Morocco', flag: '🇲🇦' },
  { region: 'TN', name: 'Tunisia', flag: '🇹🇳' },
  { region: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { region: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { region: 'DE', name: 'Germany', flag: '🇩🇪' },
  { region: 'FR', name: 'France', flag: '🇫🇷' },
  { region: 'ES', name: 'Spain', flag: '🇪🇸' },
  { region: 'IT', name: 'Italy', flag: '🇮🇹' },
  { region: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { region: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { region: 'PL', name: 'Poland', flag: '🇵🇱' },
  { region: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { region: 'NO', name: 'Norway', flag: '🇳🇴' },
  { region: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { region: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { region: 'US', name: 'United States', flag: '🇺🇸' },
  { region: 'CA', name: 'Canada', flag: '🇨🇦' },
  { region: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { region: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { region: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { region: 'CL', name: 'Chile', flag: '🇨🇱' },
  { region: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { region: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { region: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { region: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { region: 'OM', name: 'Oman', flag: '🇴🇲' },
  { region: 'IL', name: 'Israel', flag: '🇮🇱' },
  { region: 'IN', name: 'India', flag: '🇮🇳' },
  { region: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { region: 'LK', name: 'Sri Lanka', flag: '🇱🇰' },
  { region: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { region: 'CN', name: 'China', flag: '🇨🇳' },
  { region: 'JP', name: 'Japan', flag: '🇯🇵' },
  { region: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { region: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { region: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { region: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { region: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { region: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { region: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { region: 'AU', name: 'Australia', flag: '🇦🇺' },
  { region: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
];

export default function CountryScreen() {
  const { draft, update } = useOnboardingDraft();
  const configCountries = useConfigCountries();

  // REAL, live-driven part: for any `Region` where an admin has published a
  // matching Country row (matched by ISO alpha-2 `code`), override the
  // display name/flag and units with the live values. NECESSARILY still
  // bounded by mobile's Region type: a published Country whose `code` isn't
  // one of the 66 values in `Region` (admin's `code` is a free-form alpha-2
  // string, not constrained to this union) can't be surfaced here — picking
  // it would need a `Region` the rest of the app (routing, REGION_UNITS,
  // Account.region) doesn't know how to handle, which is out of scope for
  // this change. Loading, error, or zero live rows (nothing authored yet in
  // a fresh DB) all fall back to the hardcoded list/units below unchanged —
  // no visible change for anyone until an admin actually publishes country
  // data that happens to match one of these 66 codes.
  const liveByCode = new Map(
    (configCountries.data ?? []).map((c) => [c.code, c] as const),
  );

  const rows: { region: Region; name: string; flag: string; units: UnitSystem }[] = COUNTRIES.map((c) => {
    const live = liveByCode.get(c.region);
    if (!live) {
      return { region: c.region, name: c.name, flag: c.flag, units: REGION_UNITS[c.region] };
    }
    return {
      region: c.region,
      name: live.name,
      flag: live.flagEmoji ?? c.flag,
      units: {
        currency: live.currencyCode,
        distance: live.distanceUnit === 'MI' ? 'mi' : 'km',
        volume: live.volumeUnit === 'GALLON' ? 'gal' : 'L',
      },
    };
  });

  return (
    <Screen
      footer={
        <Button onPress={() => router.push('/onboarding/profile')}>Continue</Button>
      }>
      <ProgressSteps step={1} total={7} />
      <T variant="display">Where are you based?</T>
      <T variant="eyebrow" style={styles.sub}>
        SETS YOUR CURRENCY AND UNITS
      </T>
      <View style={styles.list}>
        {rows.map((c) => {
          const selected = draft.region === c.region;
          return (
            <ListRow
              key={c.region}
              title={`${c.flag}  ${c.name}`}
              meta={`${c.units.currency} · ${c.units.distance === 'km' ? 'KILOMETRES' : 'MILES'} · ${c.units.volume === 'L' ? 'LITRES' : 'GALLONS'}`}
              onPress={() => update({ region: c.region })}
              style={selected ? styles.selected : undefined}
            />
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  list: {
    marginTop: Spacing.xs,
  },
  selected: {
    backgroundColor: Colors.accentSoft,
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
  },
});
