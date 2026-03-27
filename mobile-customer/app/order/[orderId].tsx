// M25.7 — Order tracking with live status polling
import React from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '../../src/lib/orders.api'
import { useAuthStore } from '../../src/store/auth.store'
import { LoadingScreen } from '../../src/components/LoadingScreen'
import { COLORS } from '../../src/constants/colors'
import type { OrderStatus } from '../../src/types/order.types'

const STEPS: { status: OrderStatus; label: string; emoji: string }[] = [
  { status: 'PENDING',          label: 'Order Placed',       emoji: '📝' },
  { status: 'CONFIRMED',        label: 'Confirmed',          emoji: '✅' },
  { status: 'PREPARING',        label: 'Preparing',          emoji: '👨‍🍳' },
  { status: 'READY',            label: 'Ready',              emoji: '🔔' },
  { status: 'OUT_FOR_DELIVERY', label: 'On the Way',         emoji: '🚴' },
  { status: 'DELIVERED',        label: 'Delivered',          emoji: '🎉' },
]

const STATUS_ORDER: OrderStatus[] = [
  'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED',
]

function getStepIndex(status: OrderStatus): number {
  return STATUS_ORDER.indexOf(status)
}

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const router = useRouter()
  const { cartToken } = useAuthStore()

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.getOrder(orderId!, cartToken ?? undefined),
    enabled: !!orderId,
    staleTime: 10_000,
    // Poll every 15 seconds while order is active
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status) return false
      const active: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']
      return active.includes(status) ? 15_000 : false
    },
  })

  if (isLoading || !order) return <LoadingScreen />

  const isCancelled = order.status === 'CANCELLED'
  const isCompleted = order.status === 'COMPLETED' || order.status === 'DELIVERED'
  const currentStepIdx = getStepIndex(order.status)
  const currency = '$'

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={COLORS.brand} />}
      >
        {/* Order number + status */}
        <View style={styles.hero}>
          <Text style={styles.orderNum}>Order #{order.orderNumber}</Text>
          {isCancelled ? (
            <View style={styles.cancelledBadge}>
              <Text style={styles.cancelledText}>Cancelled</Text>
            </View>
          ) : isCompleted ? (
            <Text style={styles.completedText}>🎉 Completed! Thank you.</Text>
          ) : (
            <Text style={styles.activeText}>Live tracking</Text>
          )}
        </View>

        {/* Progress stepper */}
        {!isCancelled && (
          <View style={styles.stepper}>
            {STEPS.map((step, idx) => {
              const done = idx <= currentStepIdx
              const active = idx === currentStepIdx
              return (
                <View key={step.status} style={styles.step}>
                  <View style={styles.stepLeft}>
                    <View style={[
                      styles.stepDot,
                      done && styles.stepDotDone,
                      active && styles.stepDotActive,
                    ]}>
                      <Text style={styles.stepEmoji}>{step.emoji}</Text>
                    </View>
                    {idx < STEPS.length - 1 && (
                      <View style={[styles.stepLine, done && idx < currentStepIdx && styles.stepLineDone]} />
                    )}
                  </View>
                  <Text style={[styles.stepLabel, done && styles.stepLabelDone, active && styles.stepLabelActive]}>
                    {step.label}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Estimated time */}
        {order.estimatedReadyAt && !isCompleted && !isCancelled && (
          <View style={styles.etaCard}>
            <Text style={styles.etaLabel}>Estimated Ready</Text>
            <Text style={styles.etaTime}>
              {new Date(order.estimatedReadyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}

        {/* Order items */}
        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.itemsCard}>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemQty}>{item.quantity}×</Text>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.modifiers.length > 0 && (
                  <Text style={styles.itemMods} numberOfLines={1}>
                    {item.modifiers.map((m) => m.name).join(', ')}
                  </Text>
                )}
              </View>
              <Text style={styles.itemPrice}>{currency}{item.lineTotal.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.itemRow}>
            <Text style={[styles.itemQty, { opacity: 0 }]}>×</Text>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{currency}{order.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Action: back to menu */}
        {(isCompleted || isCancelled) && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.85}
          >
            <Text style={styles.backBtnText}>Back to Menu</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: 28 },
  orderNum: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  cancelledBadge: {
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  cancelledText: { fontSize: 14, color: COLORS.danger, fontWeight: '700' },
  completedText: { fontSize: 16, color: COLORS.success, fontWeight: '700' },
  activeText: { fontSize: 13, color: COLORS.brand, fontWeight: '600' },
  stepper: { marginBottom: 24 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 0 },
  stepLeft: { alignItems: 'center', width: 40 },
  stepDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotDone: { backgroundColor: COLORS.surface, borderColor: COLORS.success },
  stepDotActive: { backgroundColor: COLORS.brandLight, borderColor: COLORS.brand, borderWidth: 2.5 },
  stepEmoji: { fontSize: 18 },
  stepLine: { width: 2, height: 28, backgroundColor: COLORS.border, marginTop: 2 },
  stepLineDone: { backgroundColor: COLORS.success },
  stepLabel: { fontSize: 14, color: COLORS.muted, paddingTop: 10, flex: 1 },
  stepLabelDone: { color: COLORS.text },
  stepLabelActive: { color: COLORS.brand, fontWeight: '700' },
  etaCard: {
    backgroundColor: COLORS.brandLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  etaLabel: { fontSize: 12, color: COLORS.brand, fontWeight: '600', marginBottom: 4 },
  etaTime: { fontSize: 28, fontWeight: '800', color: COLORS.brand },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  itemsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  itemQty: { fontSize: 14, color: COLORS.muted, width: 28, fontWeight: '600' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  itemMods: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  totalLabel: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.text },
  totalValue: { fontSize: 15, fontWeight: '800', color: COLORS.brand },
  backBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  backBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
})
