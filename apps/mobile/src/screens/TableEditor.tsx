// A table inside a note, edited as a grid of real cells. Motion, as agreed:
// a new row or column appears in 0.18 s while the rest of the note glides to
// make room; removing one shrinks it away in 0.18 s. No bounce, no overshoot.
// Stored as an ordinary markdown table.

import { useState } from 'react'
import { Alert, ScrollView, Text, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
import { Press, s } from '../ui'
import { alpha, F, useTheme } from '../theme'
import { Icon } from '../icons'
import { EASE_IN, EASE_OUT } from '../motion'

const T = 180
const appear = FadeIn.duration(T).easing(EASE_OUT)
const vanish = FadeOut.duration(T).easing(EASE_IN)
const glide = LinearTransition.duration(T).easing(EASE_OUT)

let seq = 0
const key = () => `k${++seq}`

export function TableEditor({ rows, onChange, onRemove, autoFocus }: {
  rows: string[][]
  onChange: (rows: string[][]) => void
  onRemove: () => void
  autoFocus?: boolean
}) {
  const { c, read } = useTheme()
  const cols = rows[0]?.length ?? 0
  // Stable identities for rows and columns, so the right one animates in or out.
  const [rowKeys, setRowKeys] = useState(() => rows.map(key))
  const [colKeys, setColKeys] = useState(() => (rows[0] ?? []).map(key))
  if (rowKeys.length !== rows.length) setRowKeys(rows.map((_, i) => rowKeys[i] ?? key()))
  if (colKeys.length !== cols) setColKeys(Array.from({ length: cols }, (_, i) => colKeys[i] ?? key()))
  const [focus, setFocus] = useState<{ r: number; c: number } | null>(null)

  const setCell = (r: number, ci: number, v: string) => onChange(rows.map((row, i) => (i === r ? row.map((x, j) => (j === ci ? v : x)) : row)))
  const addRow = () => { setRowKeys([...rowKeys, key()]); onChange([...rows, Array(cols).fill('')]) }
  const addCol = () => { setColKeys([...colKeys, key()]); onChange(rows.map((row) => [...row, ''])) }
  const delRow = (r: number) => {
    if (rows.length <= 2) return
    setRowKeys(rowKeys.filter((_, i) => i !== r)); setFocus(null)
    onChange(rows.filter((_, i) => i !== r))
  }
  const delCol = (ci: number) => {
    if (cols <= 1) return
    setColKeys(colKeys.filter((_, i) => i !== ci)); setFocus(null)
    onChange(rows.map((row) => row.filter((_, j) => j !== ci)))
  }
  const remove = () => {
    const filled = rows.some((r) => r.some((x) => x.trim()))
    if (!filled) { onRemove(); return }
    Alert.alert('Remove this table?', 'Its cells go too.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: onRemove }])
  }

  const Chip = ({ label, icon, onPress, disabled }: { label: string; icon: React.ReactNode; onPress: () => void; disabled?: boolean }) => (
    <Press onPress={onPress} disabled={disabled} scale={0.96}
      style={[s.row, { gap: 4, paddingHorizontal: 10, height: 32, borderRadius: 10, backgroundColor: c.inkSurface, opacity: disabled ? 0.35 : 1 }]}>
      {icon}<Text style={{ fontFamily: F.sansMedium, fontSize: 12.5, color: c.paperDim }}>{label}</Text>
    </Press>
  )

  return (
    <Animated.View layout={glide} style={{ marginVertical: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View layout={glide} style={{ borderRadius: 12, borderWidth: 1, borderColor: c.inkSurface2, overflow: 'hidden' }}>
          {rows.map((row, r) => (
            <Animated.View key={rowKeys[r] ?? r} entering={appear} exiting={vanish} layout={glide}
              style={{ flexDirection: 'row', backgroundColor: r === 0 ? c.inkSurface : 'transparent', borderTopWidth: r ? 1 : 0, borderTopColor: c.inkSurface2 }}>
              {row.map((cell, ci) => {
                const on = focus?.r === r && focus?.c === ci
                return (
                  <Animated.View key={colKeys[ci] ?? ci} entering={appear} exiting={vanish} layout={glide}
                    style={{ width: 132, borderLeftWidth: ci ? 1 : 0, borderLeftColor: c.inkSurface2, backgroundColor: on ? alpha(c.accent, 0.1) : 'transparent' }}>
                    <TextInput
                      value={cell}
                      onChangeText={(v) => setCell(r, ci, v)}
                      onFocus={() => setFocus({ r, c: ci })}
                      autoFocus={autoFocus && r === 0 && ci === 0}
                      placeholder={r === 0 ? `Heading ${ci + 1}` : ''}
                      placeholderTextColor={alpha(c.paperDimmer, 0.7)}
                      selectionColor={alpha(c.accentLight, 0.5)}
                      multiline
                      style={{ fontFamily: r === 0 ? F.serifMedium : read, fontSize: 16, lineHeight: 22, color: c.paper, paddingHorizontal: 10, paddingVertical: 8, minHeight: 40 }}
                    />
                  </Animated.View>
                )
              })}
            </Animated.View>
          ))}
        </Animated.View>
      </ScrollView>
      <Animated.View layout={glide} style={[s.row, { gap: 6, marginTop: 8, flexWrap: 'wrap' }]}>
        <Chip label="row" icon={<Icon.plus size={14} color={c.accentLight} />} onPress={addRow} />
        <Chip label="column" icon={<Icon.plus size={14} color={c.accentLight} />} onPress={addCol} />
        {focus && focus.r > 0 && <Chip label="row" icon={<Icon.minus size={14} color={c.paperDim} />} onPress={() => delRow(focus.r)} disabled={rows.length <= 2} />}
        {focus && <Chip label="column" icon={<Icon.minus size={14} color={c.paperDim} />} onPress={() => delCol(focus.c)} disabled={cols <= 1} />}
        <View style={{ flex: 1 }} />
        <Chip label="remove" icon={<Icon.trash size={14} color={c.paperDim} />} onPress={remove} />
      </Animated.View>
    </Animated.View>
  )
}
