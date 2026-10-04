import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { searchPlaces, type PlaceHit } from '@/data/repo';
import { Colors, FontFamily } from '@/theme/tokens';

type Coords = { lat: number; lng: number };

type PlaceSheetProps = {
  visible: boolean;
  /** The field's label ("Station", "Workshop"). */
  title: string;
  /** What kind of place to show nearby: station, workshop, supplier, wash, parking. */
  kind?: string;
  /** Places this garage used before, offered when there is nothing nearer to show. */
  recent?: string[];
  onSelect: (name: string) => void;
  onClose: () => void;
};

function distance(m?: number) {
  if (m === undefined) return '';
  return m < 1000 ? `${Math.round(m / 10) * 10} M` : `${(m / 1000).toFixed(1)} KM`;
}

/**
 * Design "place" sheet: a search box, "Use my current location", then nearby
 * places (or search results) from Google Maps, and "Use “…”" for whatever was
 * typed. Location is only asked for when the owner taps "Use my current
 * location". Without a Places key on the server, the phone's own address
 * lookup names the current location and recent places fill the list.
 */
export function PlaceSheet({ visible, title, kind, recent = [], onSelect, onClose }: PlaceSheetProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [results, setResults] = useState<PlaceHit[]>([]);
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const seq = useRef(0);

  // Fresh each time it opens (reset during render, not in an effect).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setQuery('');
      setResults([]);
      setNote(null);
    }
  }

  // If location was allowed before, start with what is nearby.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted || cancelled) return;
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) setCoords({ lat: last.coords.latitude, lng: last.coords.longitude });
      } catch {
        // No location on this device (or web): search and typed entry still work.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Search as they type (debounced), or list what is nearby.
  useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (!q && !coords) return;
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await searchPlaces({ query: q || undefined, lat: coords?.lat, lng: coords?.lng, kind });
        if (id !== seq.current) return;
        setConfigured(res.configured);
        setResults(res.places);
      } catch {
        if (id === seq.current) setResults([]);
      } finally {
        if (id === seq.current) setBusy(false);
      }
    }, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [visible, query, coords, kind]);

  const choose = (name: string) => {
    const v = name.trim();
    if (!v) return;
    onSelect(v);
    onClose();
  };

  const useCurrent = async () => {
    setNote(null);
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setNote('Location is off for Carma. Search for the place or type its name instead.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(here);
      // The nearest place of the right kind is almost always the one they are at.
      const res = await searchPlaces({ lat: here.lat, lng: here.lng, kind }).catch(() => null);
      if (res?.places[0]) return choose(res.places[0].name);
      const [addr] = await Location.reverseGeocodeAsync({ latitude: here.lat, longitude: here.lng });
      const label = addr ? [addr.name, addr.street, addr.district ?? addr.subregion, addr.city].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 3).join(', ') : '';
      if (label) return choose(label);
      setNote('Carma could not name this spot. Search for the place or type its name.');
    } catch {
      setNote('Your location is not available right now. Search for the place or type its name.');
    } finally {
      setLocating(false);
    }
  };

  const q = query.trim().toLowerCase();
  const recentShown = recent.filter((r) => !q || r.toLowerCase().includes(q)).slice(0, 5);
  const hits = q || coords ? results : [];
  const rows: { key: string; name: string; meta: string; dist: string }[] = hits.length
    ? hits.map((p) => ({ key: p.id, name: p.name, meta: p.address, dist: distance(p.distanceM) }))
    : recentShown.map((r) => ({ key: `recent:${r}`, name: r, meta: 'Used before', dist: '' }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.grabber} />
            <View style={styles.head}>
              <View style={styles.headLeft}>
                <IconGlyph glyph="f-location" size={22} bg="transparent" scale={0.86} />
                <T style={styles.title}>{title}</T>
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Close">
                <IconGlyph glyph="close" size={32} bg="transparent" fg="#5F5A55" scale={0.44} />
              </Pressable>
            </View>

            <View style={styles.search}>
              <IconGlyph glyph="search" size={20} bg="transparent" fg="#8A847D" scale={0.9} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search a place or business"
                placeholderTextColor="#8A847D"
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={() => choose(query)}
              />
              {busy ? <ActivityIndicator size="small" color={Colors.accent} /> : null}
            </View>

            <Pressable onPress={useCurrent} disabled={locating} style={({ pressed }) => [styles.current, pressed && { backgroundColor: '#EDB81A' }]}>
              {locating ? <ActivityIndicator size="small" color="#333333" /> : <IconGlyph glyph="f-location1" size={20} bg="transparent" fg="#333333" scale={0.9} />}
              <T style={styles.currentText}>{locating ? 'Finding where you are' : 'Use my current location'}</T>
            </Pressable>
            {note ? (
              <T variant="small" color={Colors.body} style={styles.note}>
                {note}
              </T>
            ) : null}

            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {rows.map((p) => (
                <Pressable key={p.key} onPress={() => choose(p.name)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F7F9FC' }]}>
                  <View style={styles.pin}>
                    <IconGlyph glyph="f-location" size={36} bg="transparent" fg="#5F5A55" scale={0.47} />
                  </View>
                  <View style={styles.flex}>
                    <T style={styles.name} numberOfLines={1}>
                      {p.name}
                    </T>
                    {p.meta ? (
                      <T style={styles.addr} numberOfLines={1}>
                        {p.meta}
                      </T>
                    ) : null}
                  </View>
                  {p.dist ? <T style={styles.dist}>{p.dist}</T> : null}
                </Pressable>
              ))}
            </ScrollView>

            {query.trim() ? (
              <Pressable onPress={() => choose(query)} style={({ pressed }) => [styles.typed, pressed && { backgroundColor: '#F7F9FC' }]}>
                <IconGlyph glyph="add" size={18} bg="transparent" fg="#333333" scale={0.9} />
                <T style={styles.currentText} numberOfLines={1}>
                  Use “{query.trim()}”
                </T>
              </Pressable>
            ) : null}
            {configured && hits.length ? <T style={styles.credit}>PLACES FROM GOOGLE MAPS</T> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20,22,26,0.24)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingHorizontal: 16,
    maxHeight: '88%',
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#DAD7D1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.ink,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    height: 52,
    marginTop: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#F7F9FC',
    borderWidth: 0.5,
    borderColor: 'rgba(20,22,26,0.1)',
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#333333',
    paddingVertical: 0,
  },
  current: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    height: 50,
    marginTop: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#F8C01D',
  },
  currentText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#333333',
  },
  note: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  list: {
    marginTop: 8,
    maxHeight: 270,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.ink,
  },
  addr: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: '#5F5A55',
    marginTop: 3,
  },
  dist: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#8A847D',
  },
  typed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 0.5,
    borderColor: 'rgba(20,22,26,0.14)',
  },
  credit: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    letterSpacing: 1.4,
    color: '#B4AFA8',
    textAlign: 'center',
    paddingTop: 14,
  },
});
