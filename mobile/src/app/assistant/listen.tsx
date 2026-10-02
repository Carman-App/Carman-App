import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Dot } from '@/components/ui/Blocks';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useVehicle } from '@/data/hooks';
import { pushRecent } from '@/data/uiState';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

const BARS = 22;

/**
 * Dictation. Words land in a large field as they are spoken (through the
 * keyboard's own dictation, which works offline on both platforms); Stop
 * hands the sentence to Carma, which writes up the draft.
 */
export default function ListenScreen() {
  const { vehicleId, context } = useLocalSearchParams<{ vehicleId?: string; context?: string }>();
  const vehicle = useVehicle(vehicleId).data;
  const [text, setText] = useState('');
  const input = useRef<TextInput>(null);
  const [levels] = useState(() => Array.from({ length: BARS }, () => new Animated.Value(0.3)));

  useEffect(() => {
    const loops = levels.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 0.35 + ((i * 37) % 60) / 100, duration: 380 + ((i * 53) % 260), easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.2, duration: 360 + ((i * 29) % 240), easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [levels]);

  const stop = () => {
    const q = text.trim();
    if (!q) {
      router.back();
      return;
    }
    void pushRecent(q);
    router.replace({ pathname: '/assistant', params: { q, ...(vehicleId ? { vehicleId } : {}) } });
  };

  const scopeLine = [context, vehicle ? `${vehicle.make} ${vehicle.model}` : null].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar
        backGlyph="close"
        backLabel="CANCEL"
        right={
          <View style={styles.listening}>
            <Dot />
            <T variant="eyebrow" color={Colors.body}>
              LISTENING
            </T>
          </View>
        }
      />
      {scopeLine ? (
        <View style={styles.scope}>
          <T variant="eyebrow" color={Colors.accent}>
            {scopeLine.toUpperCase()}
          </T>
        </View>
      ) : null}
      <Pressable style={styles.body} onPress={() => input.current?.focus()}>
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          autoFocus
          multiline
          placeholder="Say what happened. Tap the microphone on your keyboard to dictate."
          placeholderTextColor={Colors.textFaint}
          style={styles.transcript}
        />
        <T variant="meta" color={Colors.textFaint}>
          Keep going, or stop and let Carma write it up.
        </T>
      </Pressable>
      <View style={styles.wave}>
        {levels.map((v, i) => (
          <Animated.View
            key={i}
            style={[styles.bar, { backgroundColor: i % 7 === 3 ? Colors.chipStrong : i % 3 === 0 ? Colors.lineStrong : Colors.accent, transform: [{ scaleY: v }] }]}
          />
        ))}
      </View>
      <View style={styles.foot}>
        <Pressable onPress={stop} style={({ pressed }) => [styles.stop, pressed && { backgroundColor: Colors.ctaPressed }]} accessibilityLabel="Stop">
          <IconGlyph glyph="stop" size={64} bg="transparent" fg={Colors.ink} scale={0.36} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listening: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  scope: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.accentSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  body: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  transcript: {
    outlineWidth: 0,
    fontFamily: FontFamily.medium,
    fontSize: 24,
    lineHeight: 31,
    letterSpacing: -0.3,
    color: Colors.ink,
    maxHeight: 340,
  },
  wave: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.lg,
  },
  bar: {
    width: 8,
    height: 44,
    borderRadius: 4,
  },
  foot: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  stop: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
