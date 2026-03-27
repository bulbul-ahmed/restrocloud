// M25.2 — Cart management + checkout trigger
import React from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { cartApi } from '../../src/lib/cart.api'
import { useAuthStore } from '../../src/store/auth.store'
import { useCartStore } from '../../src/store/cart.store'
import { CartItemRow } from '../../src/components/CartItemRow'
import { COLORS } from '../../src/constants/colors'

export default function CartScreen() {
  const router = useRouter()
  const { accessToken, cartToken } = useAuthStore()
  const { cart, restaurantId, setCart } = useCartStore()

  const currency = '$'

  const updateMutation = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) => {
      if (!restaurantId || !cartToken) throw new Error('No cart')
      return cartApi.updateItem(itemId, restaurantId, cartToken, qty)
    },
    onSuccess: setCart,
  })

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => {
      if (!restaurantId || !cartToken) throw new Error('No cart')
      return cartApi.removeItem(itemId, restaurantId, cartToken)
    },
    onSuccess: setCart,
  })

  function handleCheckout() {
    if (!accessToken) {
      Alert.alert(
        'Sign in Required',
        'Please sign in to complete your order.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
        ],
      )
      return
    }
    router.push('/checkout')
  }

  const items = cart?.items ?? []

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Add items from the menu to get started</Text>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.85}
          >
            <Text style={styles.browseBtnText}>Browse Menu</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CartItemRow
            item={item}
            currency={currency}
            onIncrement={() => updateMutation.mutate({ itemId: item.id, qty: item.quantity + 1 })}
            onDecrement={() => {
              if (item.quantity === 1) {
                removeMutation.mutate(item.id)
              } else {
                updateMutation.mutate({ itemId: item.id, qty: item.quantity - 1 })
              }
            }}
          />
        )}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <View style={styles.summary}>
            <SummaryRow label="Subtotal" value={`${currency}${cart?.subtotal.toFixed(2)}`} />
            {(cart?.tax ?? 0) > 0 && (
              <SummaryRow label="Tax" value={`${currency}${cart?.tax.toFixed(2)}`} />
            )}
            {(cart?.serviceCharge ?? 0) > 0 && (
              <SummaryRow label="Service Charge" value={`${currency}${cart?.serviceCharge.toFixed(2)}`} />
            )}
            <SummaryRow
              label="Total"
              value={`${currency}${cart?.total.toFixed(2)}`}
              bold
            />
          </View>
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout} activeOpacity={0.85}>
          <Text style={styles.checkoutText}>
            Checkout • {currency}{cart?.total.toFixed(2)}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function SummaryRow({ label, value, bold = false }: { label: string; value?: string; bold?: boolean }) {
  return (
    <View style={sr.row}>
      <Text style={[sr.label, bold && sr.bold]}>{label}</Text>
      <Text style={[sr.value, bold && sr.bold]}>{value ?? '—'}</Text>
    </View>
  )
}
const sr = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 14, color: COLORS.muted },
  value: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  bold: { fontSize: 16, color: COLORS.text, fontWeight: '800' },
})

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  list: { padding: 16 },
  summary: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  checkoutBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  checkoutText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', marginBottom: 24 },
  browseBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  browseBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
})
