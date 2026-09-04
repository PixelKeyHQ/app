import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { qrMatrix } from '../core/codec';

export function ProfileQr({ link, size = 248 }: { link: string; size?: number }) {
  const cells = useMemo(() => qrMatrix(link), [link]);
  const side = cells.length + 4;
  const path = cells.map((row, y) => {
    let d = '';
    for (let x = 0; x < row.length;) {
      if (!row[x]) { x++; continue; }
      let end = x; while (row[end]) end++;
      d += `M${x + 2},${y + 2}h${end - x}v1h-${end - x}z`; x = end;
    }
    return d;
  }).join('');
  return <View accessibilityLabel="连接信息二维码" testID="profile-qr" style={{ alignSelf: 'center', padding: 12, backgroundColor: '#FFFFFF', borderRadius: 18 }}>
    <Svg width={size} height={size} viewBox={`0 0 ${side} ${side}`}>
      <Rect width={side} height={side} fill="#fff" />
      <Path d={path} fill="#000" />
    </Svg>
  </View>;
}
