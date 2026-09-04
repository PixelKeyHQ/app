import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ORIGINAL_MODELS, SAVER_MODELS, type Model } from '../core/profile';
import { cardShadow, type Theme } from '../theme';
import { Icon, NavBar, NavText } from '../ui';

export function ModelPicker({ theme, model, onPick, onDone }: { theme: Theme; model: Model; onPick: (model: Model) => void; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const section = (title: string, models: readonly Model[], foot?: string) => <View style={styles.section}>
    <Text style={[styles.header, { color: theme.muted }]}>{title}</Text>
    <View style={[styles.card, { backgroundColor: theme.surface }, cardShadow(theme)]}>
      {models.map((name, i) => <Pressable key={name} accessibilityRole="radio" accessibilityState={{ checked: name === model }} onPress={() => onPick(name)}
        style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator }, pressed && { backgroundColor: theme.default }]}>
        <Text style={[styles.name, { color: theme.foreground }]}>{name}</Text>
        {name === model && <Icon name="check" size={20} width={2.4} color={theme.accent} />}
      </Pressable>)}
    </View>
    {!!foot && <Text style={[styles.foot, { color: theme.muted }]}>{foot}</Text>}
  </View>;
  return <View style={[styles.page, { backgroundColor: theme.background, paddingTop: insets.top }]}>
    <NavBar theme={theme} title="备份机型" right={<NavText theme={theme} title="完成" onPress={onDone} />} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}>
      <Text style={[styles.intro, { color: theme.muted }]}>照片会以所选机型的身份备份，画质和是否占用存储空间按这台机型的权益计算。</Text>
      {section('原画质 · 不占空间', ORIGINAL_MODELS)}
      {section('节省空间画质 · 不占空间', SAVER_MODELS, 'Pixel 5a 及之后的机型没有免费备份权益。')}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingTop: 4, paddingHorizontal: 16, gap: 22 },
  intro: { paddingHorizontal: 4, fontSize: 15, lineHeight: 21 },
  section: { gap: 6 },
  header: { paddingHorizontal: 4, fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 24, overflow: 'hidden' },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  name: { flex: 1, fontSize: 17 },
  foot: { paddingTop: 6, paddingHorizontal: 4, fontSize: 13, lineHeight: 18 },
});
