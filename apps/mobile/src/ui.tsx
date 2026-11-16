// Shared building blocks. Every press springs a little (Reanimated, on the UI
// thread), every list is virtualised, and nothing animates on the JS thread.

import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, FadeIn } from 'react-native-reanimated'
import { pressDown, pressUp } from './motion'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { alpha, F, useTheme } from './theme'
import { Icon } from './icons'

const APressable = Animated.createAnimatedComponent(Pressable)

/** A Pressable that dips slightly when touched. */
export function Press({ style, children, haptic, scale = 0.985, ...rest }: PressableProps & {
  style?: StyleProp<ViewStyle>; children?: ReactNode; haptic?: boolean; scale?: number
}) {
  const s = useSharedValue(1)
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }))
  return (
    <APressable
      {...rest}
      onPressIn={(e) => { s.value = pressDown(scale); rest.onPressIn?.(e) }}
      onPressOut={(e) => { s.value = pressUp(); rest.onPressOut?.(e) }}
      onPress={(e) => { if (haptic) void Haptics.selectionAsync(); rest.onPress?.(e) }}
      style={[style, anim]}
    >
      {children}
    </APressable>
  )
}

export function IconButton({ onPress, label, children, tint }: { onPress: () => void; label: string; children: ReactNode; tint?: string }) {
  const { c } = useTheme()
  return (
    <Press onPress={onPress} accessibilityLabel={label} hitSlop={6} scale={0.9}
      style={[s.iconBtn, tint ? { backgroundColor: tint } : null]} android_ripple={{ color: alpha(c.paper, 0.08), borderless: true }}>
      {children}
    </Press>
  )
}

export function Header({ title, sub, onBack, right, big }: {
  title?: ReactNode; sub?: string; onBack?: () => void; right?: ReactNode; big?: boolean
}) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.header, { paddingTop: insets.top + 6, backgroundColor: c.ink }]}>
      {onBack && <IconButton onPress={onBack} label="Back"><Icon.back color={c.paperDim} /></IconButton>}
      <View style={{ flex: 1, paddingLeft: onBack ? 2 : 8 }}>
        {typeof title === 'string'
          ? <Text numberOfLines={1} style={{ fontFamily: F.serif, fontSize: big ? 28 : 22, color: c.paper }}>{title}</Text>
          : title}
        {sub ? <Text numberOfLines={1} style={{ fontFamily: F.sans, fontSize: 12, color: c.paperDimmer, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      <View style={s.row}>{right}</View>
    </View>
  )
}

export function Eyebrow({ children, color, style }: { children: ReactNode; color?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  return (
    <View style={style}>
      <Text style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: color ?? c.paperDimmer }}>{children}</Text>
    </View>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  return <View style={[{ backgroundColor: c.inkSurface, borderRadius: 20, overflow: 'hidden' }, style]}>{children}</View>
}

export function Row({ icon, title, hint, right, onPress }: { icon?: ReactNode; title: string; hint?: string; right?: ReactNode; onPress?: () => void }) {
  const { c } = useTheme()
  const body = (
    <View style={s.rowItem}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.sans, fontSize: 15.5, color: c.paper }}>{title}</Text>
        {hint ? <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: c.paperDimmer, marginTop: 2, lineHeight: 17 }}>{hint}</Text> : null}
      </View>
      {right}
    </View>
  )
  return onPress
    ? <Pressable onPress={onPress} android_ripple={{ color: alpha(c.paper, 0.06) }}>{body}</Pressable>
    : body
}

export function Divider() {
  const { c } = useTheme()
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.inkSurface2, marginLeft: 16 }} />
}

export function Field({ style, mono, ...p }: TextInputProps & { mono?: boolean }) {
  const { c } = useTheme()
  return (
    <TextInput
      placeholderTextColor={c.paperDimmer}
      selectionColor={alpha(c.accentLight, 0.5)}
      {...p}
      style={[s.field, { color: c.paper, backgroundColor: c.inkSurface, fontFamily: mono ? F.mono : F.sans }, style]}
    />
  )
}

export function SearchField({ value, onChange, placeholder = 'Search notes', mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean
}) {
  const { c } = useTheme()
  return (
    <View style={[s.search, { backgroundColor: c.inkSurface }]}>
      <Icon.search color={c.paperDimmer} size={18} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.paperDimmer}
        selectionColor={alpha(c.accentLight, 0.5)} autoCorrect={false} returnKeyType="search"
        style={{ flex: 1, color: c.paper, fontFamily: mono ? F.mono : F.sans, fontSize: mono ? 14 : 15.5, paddingVertical: 12 }} />
      {value ? <IconButton onPress={() => onChange('')} label="Clear"><Icon.close color={c.paperDimmer} size={16} /></IconButton> : null}
    </View>
  )
}

export function Button({ title, onPress, icon, kind = 'primary', disabled }: {
  title: string; onPress: () => void; icon?: ReactNode; kind?: 'primary' | 'quiet' | 'danger'; disabled?: boolean
}) {
  const { c } = useTheme()
  const bg = kind === 'primary' ? c.accent : c.inkSurface
  const fg = kind === 'primary' ? c.onAccent : kind === 'danger' ? '#f87171' : c.paper
  return (
    <Press onPress={onPress} disabled={disabled} haptic style={[s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }]}>
      {icon}
      <Text style={{ fontFamily: F.sansSemi, fontSize: 15, color: fg }}>{title}</Text>
    </Press>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  const { c } = useTheme()
  return (
    <Animated.View entering={FadeIn.duration(260)} style={{ alignItems: 'center', paddingVertical: 72, paddingHorizontal: 28 }}>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: c.inkSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>{icon}</View>
      <Text style={{ fontFamily: F.serif, fontSize: 21, color: c.paper, textAlign: 'center' }}>{title}</Text>
      {children ? <Text style={{ fontFamily: F.sans, fontSize: 14, lineHeight: 21, color: c.paperDimmer, textAlign: 'center', marginTop: 8 }}>{children}</Text> : null}
    </Animated.View>
  )
}

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  field: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15.5 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, paddingLeft: 14, paddingRight: 4 },
  btn: { height: 50, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  page: { paddingHorizontal: 16 },
})
