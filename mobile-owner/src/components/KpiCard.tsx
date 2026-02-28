import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { COLORS } from '../constants/colors'

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  subColor?: string
}

export function KpiCard({ label, value, sub, subColor = COLORS.muted }: KpiCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {sub ? <Text style={[styles.sub, { color: subColor }]}>{sub}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    margin: 4,
    minWidth: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 11,
    color: COLORS.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
})
