import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { COLORS } from '../constants/colors'
import type { Order, OrderStatus } from '../types/order.types'

interface Props {
  order: Order
  currency?: string
  onPress: () => void
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  PENDING:   { label: 'Pending',   color: COLORS.warning, bg: '#FEF9EE' },
  ACCEPTED:  { label: 'Confirmed', color: '#3B82F6',      bg: '#EFF6FF' },
  PREPARING: { label: 'Preparing', color: COLORS.brand,   bg: COLORS.brandLight },
  READY:     { label: 'Ready',     color: COLORS.success, bg: '#F0FDF4' },
  SERVED:    { label: 'Served',    color: '#0D9488',      bg: '#F0FDFA' },
  COMPLETED: { label: 'Completed', color: COLORS.muted,   bg: COLORS.surface },
  CANCELLED: { label: 'Cancelled', color: COLORS.danger,  bg: '#FFF5F5' },
  REFUNDED:  { label: 'Refunded',  color: '#7C3AED',      bg: '#F5F3FF' },
}

export function OrderCard({ order, currency = '$', onPress }: Props) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING
  const date = new Date(order.createdAt).toLocaleDateString()

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        <Text style={styles.number}>#{order.orderNumber}</Text>
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={styles.items} numberOfLines={2}>
        {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.date}>{date}</Text>
        <Text style={styles.total}>{currency}{order.total.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  number: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  items: { fontSize: 13, color: COLORS.muted, marginBottom: 10, lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 12, color: COLORS.muted },
  total: { fontSize: 15, fontWeight: '700', color: COLORS.brand },
})
