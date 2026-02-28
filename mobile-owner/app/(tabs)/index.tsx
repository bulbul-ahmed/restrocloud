// M23.2 — Dashboard: today's sales, order count, live orders
import React from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../../src/store/auth.store'
import { analyticsApi } from '../../src/lib/analytics.api'
import { ordersApi } from '../../src/lib/orders.api'
import { KpiCard } from '../../src/components/KpiCard'
import { OrderCard } from '../../src/components/OrderCard'
import { COLORS } from '../../src/constants/colors'

export default function DashboardScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const rid = user?.restaurantId ?? ''

  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useQuery({
    queryKey: ['dashboard', rid],
    queryFn: () => analyticsApi.getDashboard(rid),
    enabled: !!rid,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const { data: liveOrders, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', rid, 'PENDING', 'dashboard'],
    queryFn: () => ordersApi.list(rid, { status: 'PENDING', limit: 5 }),
    enabled: !!rid,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })

  const refreshing = kpisLoading || ordersLoading
  function onRefresh() {
    refetchKpis()
    refetchOrders()
  }

  const today = kpis?.today
  const delta = kpis?.vsYesterday
  const revenueChange = delta?.revenueChange ?? 0
  const deltaColor = revenueChange >= 0 ? COLORS.success : COLORS.danger
  const deltaSign = revenueChange >= 0 ? '+' : ''

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand} />}
      >
        {/* Welcome */}
        <Text style={styles.greeting}>Good {getGreeting()}, {user?.firstName} 👋</Text>

        {/* Revenue hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Revenue Today</Text>
          <Text style={styles.heroValue}>
            ৳{today ? today.revenue.toLocaleString('en', { minimumFractionDigits: 2 }) : '—'}
          </Text>
          {delta ? (
            <Text style={[styles.heroDelta, { color: deltaColor }]}>
              {deltaSign}{revenueChange.toFixed(1)}% vs yesterday
            </Text>
          ) : null}
        </View>

        {/* KPI grid */}
        <View style={styles.kpiRow}>
          <KpiCard
            label="Orders"
            value={today ? String(today.orders) : '—'}
            sub={today ? `${today.completedOrders} completed` : undefined}
          />
          <KpiCard
            label="Pending"
            value={today ? String(today.pendingOrders) : '—'}
            subColor={today && today.pendingOrders > 0 ? COLORS.warning : COLORS.muted}
            sub={today && today.pendingOrders > 0 ? 'needs action' : 'all clear'}
          />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard
            label="Avg Ticket"
            value={today ? `৳${today.avgOrderValue.toFixed(2)}` : '—'}
          />
          <KpiCard
            label="Tables Active"
            value={today ? String(today.activeTableSessions) : '—'}
          />
        </View>

        {/* Live orders strip */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Orders</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {(liveOrders?.orders ?? []).length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No pending orders</Text>
            </View>
          ) : (
            (liveOrders?.orders ?? []).map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onPress={() => router.push(`/orders/${order.id}` as any)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  greeting: {
    fontSize: 16,
    color: COLORS.muted,
    marginBottom: 16,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroLabel: {
    fontSize: 13,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.text,
  },
  heroDelta: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  kpiRow: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 8,
  },
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  seeAll: {
    fontSize: 13,
    color: COLORS.brand,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
  },
})
