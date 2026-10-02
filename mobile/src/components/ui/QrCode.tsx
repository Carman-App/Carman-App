import { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';

import { Colors } from '@/theme/tokens';

// The core encoder only: pure JS, no canvas/fs, safe on native and web.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('qrcode/lib/core/qrcode') as typeof import('qrcode');

/** A scannable QR code drawn with react-native-svg. */
export function QrCode({ value, size = 180, color = Colors.ink }: { value: string; size?: number; color?: string }) {
  const { modules, count } = useMemo(() => {
    const qr = create(value, { errorCorrectionLevel: 'M' });
    return { modules: qr.modules.data, count: qr.modules.size };
  }, [value]);
  const quiet = 2;
  const total = count + quiet * 2;
  const rects = [];
  for (let y = 0; y < count; y += 1) {
    for (let x = 0; x < count; x += 1) {
      if (modules[y * count + x]) rects.push(<Rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width={1.02} height={1.02} fill={color} />);
    }
  }
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
      <Rect x={0} y={0} width={total} height={total} fill={Colors.white} />
      {rects}
    </Svg>
  );
}
