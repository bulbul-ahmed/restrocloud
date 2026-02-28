// M23.4 — Order detail: view items + accept/reject
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../src/store/auth.store'
import { ordersApi } from '../../src/lib/orders.api'
import { COLORS } from '../../src/constants/colors'

const STATUS_COLOR: Record<string, string> = {
  PENDING: COLORS.pending,
  ACCEPTED: COLORS.success,
  PREPARING: COLORS.warning,
  READY: '#06B6D4',
  COMPLETED: COLORS.muted,
  CANCELLED: COLORS.danger,
  REJECTED: COLORS.danger,
}

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const rid = user?.restaurantId ?? ''
  const queryClient = useQueryClient()
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', rid, orderId],
    queryFn: () => ordersApi.get(rid, orderId!),
    enabled: !!rid && !!orderId,
  })

  const acceptMutation = useMutation({
    mutationFn: () => ordersApi.accept(rid, orderId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', rid] })
      queryClient.invalidateQueries({ queryKey: ['order', rid, orderId] })
      Alert.alert('Order Accepted', `#${order?.orderNumber} has been accepted.`)
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  })

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => ordersApi.reject(rid, orderId!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', rid] })
      setRejectModal(false)
      router.back()
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  })

  if (isLoading || !order) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.brand} />
      </View>
    )
  }

  const isPending = order.status === 'PENDING'
  const statusColor = STATUS_COLOR[order.status] ?? COLORS.muted

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.orderNum}>#{order.orderNumber}</Text>
            <View style={[styles.badge, { backgroundColor: statusColor }]}>
              <Text style={styles.badgeText}>{order.status}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            Channel: {order.channel}
            {order.guestName ? `  ·  ${order.guestName}` : ''}
          </Text>
          <Text style={styles.meta}>{new Date(order.createdAt).toLocaleString()}</Text>
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemName}>{item.quantity}× {item.name}</Text>
                {item.modifiers?.map((m, i) => (
                  <Text key={i} style={styles.modifier}>+ {m.name}</Text>
                ))}
                {item.notes ? <Text style={styles.modifier}>{item.notes}</Text> : null}
              </View>
              <Text style={styles.itemPrice}>৳{parseFloat(item.totalPrice).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Row label="Subtotal" value={`৳${parseFloat(order.subtotal).toFixed(2)}`} />
          {parseFloat(order.taxAmount) > 0 && (
            <Row label="Tax" value={`৳${parseFloat(order.taxAmount).toFixed(2)}`} />
          )}
          {parseFloat(order.serviceCharge) > 0 && (
            <Row label="Service Charge" value={`৳${parseFloat(order.serviceCharge).toFixed(2)}`} />
          )}
          {parseFloat(order.discountAmount) > 0 && (
            <Row
              label="Discount"
              value={`-৳${parseFloat(order.discountAmount).toFixed(2)}`}
              valueColor={COLORS.success}
            />
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>৳{parseFloat(order.totalAmount).toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes */}
        {order.notes ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Customer Notes</Text>
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        ) : null}

        {/* Actions */}
        {isPending && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.acceptBtn]}
              onPress={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
            >
              <Text style={styles.btnText}>
                {acceptMutation.isPending ? 'Accepting…' : '✓ Accept Order'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={() => setRejectModal(true)}
            >
              <Text style={styles.btnText}>✕ Reject Order</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Reject modal */}
      <Modal
        visible={rejectModal}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject Order #{order.orderNumber}</Text>
            <Text style={styles.modalLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. Out of stock items"
              placeholderTextColor={COLORS.muted}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => rejectMutation.mutate(rejectReason)}
                disabled={rejectMutation.isPending}
              >
                <Text style={styles.btnText}>
                  {rejectMutation.isPending ? 'Rejecting…' : 'Confirm Reject'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 48 },

  headerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNum: { fontSize: 20, fontWeight: '800', color: COLORS.text, fontFamily: 'monospace' },
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
  meta: { fontSize: 13, color: COLORS.muted },

  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.muted, marginBottom: 12, textTransform: 'uppercase' },

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemLeft: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  modifier: { fontSize: 12, color: COLORS.muted },
  itemPrice: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginLeft: 12 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 14, color: COLORS.muted },
  summaryValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  totalValue: { fontSize: 16, fontWeight: '800', color: COLORS.brand },

  notesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  notesLabel: { fontSize: 12, color: COLORS.muted, textTransform: 'uppercase', fontWeight: '600' },
  notesText: { fontSize: 14, color: COLORS.text },

  actions: { gap: 12, marginTop: 8 },
  btn: { borderRadius: 12, padding: 16, alignItems: 'center' },
  acceptBtn: { backgroundColor: COLORS.success },
  rejectBtn: { backgroundColor: COLORS.danger },
  btnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalLabel: { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  modalInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalCancel: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.muted },
  modalConfirm: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: COLORS.danger },
})
