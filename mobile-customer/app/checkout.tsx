// M25.2 — Checkout: order type, delivery address, payment, place order
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { ordersApi } from '../src/lib/orders.api'
import { loyaltyApi } from '../src/lib/loyalty.api'
import { useAuthStore } from '../src/store/auth.store'
import { useCartStore } from '../src/store/cart.store'
import { COLORS } from '../src/constants/colors'

type OrderType = 'PICKUP' | 'DELIVERY'
type PaymentMethod = 'CASH' | 'CARD' | 'ONLINE'

export default function CheckoutScreen() {
  const router = useRouter()
  const { cartToken } = useAuthStore()
  const { cart, restaurantId, clearCart } = useCartStore()
  const [orderType, setOrderType] = useState<OrderType>('PICKUP')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: loyaltyApi.listAddresses,
  })

  const placeMutation = useMutation({
    mutationFn: () => {
      if (!restaurantId || !cartToken) throw new Error('No cart')
      if (orderType === 'DELIVERY' && !selectedAddressId) {
        throw new Error('Please select a delivery address.')
      }
      return ordersApi.placeOrder({
        restaurantId,
        cartToken,
        orderType,
        deliveryAddressId: orderType === 'DELIVERY' ? selectedAddressId! : undefined,
        notes: notes || undefined,
        paymentMethod,
      })
    },
    onSuccess: (order) => {
      clearCart()
      router.replace(`/order/${order.id}` as any)
    },
    onError: (err: any) => {
      Alert.alert('Order Failed', err?.message ?? 'Please try again.')
    },
  })

  const currency = '$'

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Order type */}
        <Text style={styles.sectionTitle}>Order Type</Text>
        <View style={styles.toggleRow}>
          {(['PICKUP', 'DELIVERY'] as OrderType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.toggle, orderType === type && styles.toggleActive]}
              onPress={() => setOrderType(type)}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, orderType === type && styles.toggleTextActive]}>
                {type === 'PICKUP' ? '🏃 Pickup' : '🚴 Delivery'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Delivery address */}
        {orderType === 'DELIVERY' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            {(addresses ?? []).length === 0 ? (
              <Text style={styles.hint}>No saved addresses. Please add one in your Account.</Text>
            ) : (
              (addresses ?? []).map((addr) => (
                <TouchableOpacity
                  key={addr.id}
                  style={[styles.addrOption, selectedAddressId === addr.id && styles.addrOptionSelected]}
                  onPress={() => setSelectedAddressId(addr.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.radioCircle, selectedAddressId === addr.id && styles.radioSelected]} />
                  <View style={styles.addrText}>
                    <Text style={styles.addrStreet}>{addr.street}</Text>
                    <Text style={styles.addrCity}>{addr.city}</Text>
                  </View>
                  {addr.isDefault && <Text style={styles.defaultTag}>Default</Text>}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Payment method */}
        <Text style={styles.sectionTitle}>Payment</Text>
        <View style={styles.paymentOptions}>
          {([
            { key: 'CASH', label: '💵 Cash on Pickup' },
            { key: 'CARD', label: '💳 Card on Pickup' },
            { key: 'ONLINE', label: '📱 Online Payment' },
          ] as { key: PaymentMethod; label: string }[]).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.payOption, paymentMethod === key && styles.payOptionSelected]}
              onPress={() => setPaymentMethod(key)}
              activeOpacity={0.8}
            >
              <View style={[styles.radioCircle, paymentMethod === key && styles.radioSelected]} />
              <Text style={styles.payLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Order summary */}
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.summary}>
          {(cart?.items ?? []).map((item) => (
            <View key={item.id} style={styles.summaryRow}>
              <Text style={styles.summaryItem} numberOfLines={1}>
                {item.quantity}× {item.name}
              </Text>
              <Text style={styles.summaryPrice}>{currency}{item.lineTotal.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotal}>Total</Text>
            <Text style={styles.summaryTotalValue}>{currency}{cart?.total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.placeBtn, placeMutation.isPending && styles.placeBtnDisabled]}
          onPress={() => placeMutation.mutate()}
          disabled={placeMutation.isPending}
          activeOpacity={0.85}
        >
          <Text style={styles.placeBtnText}>
            {placeMutation.isPending ? 'Placing Order…' : `Place Order • ${currency}${cart?.total.toFixed(2)}`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 20,
  },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: COLORS.brandLight, borderColor: COLORS.brand },
  toggleText: { fontSize: 14, fontWeight: '600', color: COLORS.muted },
  toggleTextActive: { color: COLORS.brand },
  section: { marginBottom: 8 },
  hint: { fontSize: 13, color: COLORS.muted, fontStyle: 'italic', paddingVertical: 8 },
  addrOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  addrOptionSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  radioSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brand },
  addrText: { flex: 1 },
  addrStreet: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  addrCity: { fontSize: 12, color: COLORS.muted },
  defaultTag: { fontSize: 10, color: COLORS.brand, fontWeight: '700' },
  paymentOptions: { gap: 8 },
  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  payOptionSelected: { borderColor: COLORS.brand, backgroundColor: COLORS.brandLight },
  payLabel: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  summary: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  summaryItem: { fontSize: 13, color: COLORS.text, flex: 1, marginRight: 8 },
  summaryPrice: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  summaryTotal: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  summaryTotalValue: { fontSize: 15, fontWeight: '800', color: COLORS.brand },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg },
  placeBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  placeBtnDisabled: { opacity: 0.6 },
  placeBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
})
