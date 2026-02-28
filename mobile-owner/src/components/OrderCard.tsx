import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { COLORS } from '../constants/colors'
import type { Order } from '../types/orders.types'

interface OrderCardProps {
  order: Order
  onPress: () => void
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: COLORS.pending,
  ACCEPTED: COLORS.success,
  PREPARING: COLORS.warning,
  READY: '#06B6D4',
  SERVED: COLORS.muted,
  COMPLETED: COLORS.muted,
  CANCELLED: COLORS.danger,
  REJECTED: COLORS.danger,
}

const CHANNEL_COLOR: Record<string, string> = {
  POS: '#3B82F6',
  QR: '#8B5CF6',
  ONLINE: '#F97316',
  AGGREGATOR: '#EC4899',
  DINE_IN: '#22C55E',
  TAKEAWAY: '#6366F1',
  DELIVERY: '#F59E0B',
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export function OrderCard({ order, onPress }: OrderCardProps) {
  const itemCount = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.row}>
        <Text style={styles.number}>#{order.orderNumber}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLOR[order.status] ?? COLORS.muted }]}>
          <Text style={styles.badgeText}>{order.status}</Text>
        </View>
      </View>
      <View style={styles.row}>
        <View style={[styles.channelBadge, { backgroundColor: CHANNEL_COLOR[order.channel] ?? COLORS.muted }]}>
          <Text style={styles.channelText}>{order.channel}</Text>
        </View>
        <Text style={styles.meta}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
        <Text style={styles.meta}>{timeAgo(order.createdAt)}</Text>
      </View>
      <Text style={styles.amount}>৳{parseFloat(order.totalAmount).toFixed(2)}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  number: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    fontFamily: 'monospace',
    flex: 1,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.white,
  },
  channelBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  channelText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.white,
  },
  meta: {
    fontSize: 12,
    color: COLORS.muted,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.brand,
  },
})
