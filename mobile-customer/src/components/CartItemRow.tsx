import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { COLORS } from '../constants/colors'
import type { CartItem } from '../types/cart.types'

interface Props {
  item: CartItem
  currency?: string
  onIncrement: () => void
  onDecrement: () => void
}

export function CartItemRow({ item, currency = '$', onIncrement, onDecrement }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        {item.modifiers.length > 0 && (
          <Text style={styles.mods} numberOfLines={2}>
            {item.modifiers.map((m) => m.name).join(', ')}
          </Text>
        )}
        <Text style={styles.price}>{currency}{item.lineTotal.toFixed(2)}</Text>
      </View>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={onDecrement}>
          <Text style={styles.qtyBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qty}>{item.quantity}</Text>
        <TouchableOpacity style={styles.qtyBtn} onPress={onIncrement}>
          <Text style={styles.qtyBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  mods: { fontSize: 12, color: COLORS.muted, marginBottom: 4 },
  price: { fontSize: 14, fontWeight: '700', color: COLORS.brand },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: { fontSize: 18, color: COLORS.text, fontWeight: '600', lineHeight: 22 },
  qty: { fontSize: 15, fontWeight: '700', color: COLORS.text, minWidth: 20, textAlign: 'center' },
})
