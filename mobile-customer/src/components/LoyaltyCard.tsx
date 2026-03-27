import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from '../constants/colors'
import type { LoyaltyDashboard } from '../types/loyalty.types'

interface Props {
  loyalty: LoyaltyDashboard
}

export function LoyaltyCard({ loyalty }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>Points Balance</Text>
          <Text style={styles.points}>{loyalty.points.toLocaleString()}</Text>
          {loyalty.redeemablePoints > 0 && (
            <Text style={styles.redeemable}>
              {loyalty.redeemablePoints} pts redeemable
            </Text>
          )}
        </View>
        {loyalty.tier && (
          <View style={styles.tier}>
            <Text style={styles.tierEmoji}>⭐</Text>
            <Text style={styles.tierName}>{loyalty.tier.name}</Text>
          </View>
        )}
      </View>
      {loyalty.tier && loyalty.tier.discountPercent > 0 && (
        <View style={styles.perk}>
          <Text style={styles.perkText}>
            {loyalty.tier.discountPercent}% discount on all orders
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.brand,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500', marginBottom: 2 },
  points: { fontSize: 36, fontWeight: '800', color: COLORS.white },
  redeemable: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  tier: { alignItems: 'center' },
  tierEmoji: { fontSize: 28 },
  tierName: { fontSize: 12, color: COLORS.white, fontWeight: '700', marginTop: 2 },
  perk: {
    marginTop: 14,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
    padding: 8,
  },
  perkText: { fontSize: 12, color: COLORS.white, fontWeight: '600', textAlign: 'center' },
})
