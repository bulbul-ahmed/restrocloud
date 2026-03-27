// M25.4 — Loyalty dashboard + M25.6 — Saved addresses + account management
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { loyaltyApi } from '../../src/lib/loyalty.api'
import { useAuthStore } from '../../src/store/auth.store'
import { LoyaltyCard } from '../../src/components/LoyaltyCard'
import { COLORS } from '../../src/constants/colors'

export default function AccountScreen() {
  const router = useRouter()
  const qc = useQueryClient()
  const { user, accessToken, logout } = useAuthStore()

  const { data: loyalty, isLoading: loyaltyLoading, refetch } = useQuery({
    queryKey: ['loyalty'],
    queryFn: loyaltyApi.getDashboard,
    enabled: !!accessToken,
    staleTime: 60_000,
  })

  const { data: addresses, refetch: refetchAddresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: loyaltyApi.listAddresses,
    enabled: !!accessToken,
    staleTime: 60_000,
  })

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => loyaltyApi.listNotifications(1, 5),
    enabled: !!accessToken,
    staleTime: 30_000,
  })

  const setDefaultMutation = useMutation({
    mutationFn: loyaltyApi.setDefaultAddress,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  })

  const deleteAddressMutation = useMutation({
    mutationFn: loyaltyApi.deleteAddress,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  })

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ])
  }

  if (!accessToken) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.signInPrompt}>
          <Text style={styles.promptEmoji}>👤</Text>
          <Text style={styles.promptTitle}>Sign in to your account</Text>
          <Text style={styles.promptSubtitle}>
            Track orders, earn loyalty points, and manage saved addresses
          </Text>
          <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.registerBtn} onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.registerBtnText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const unreadCount = (notifData?.notifications ?? []).filter((n) => !n.isRead).length

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loyaltyLoading} onRefresh={refetch} tintColor={COLORS.brand} />
        }
      >
        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.firstName?.[0]?.toUpperCase()}{user?.lastName?.[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.firstName} {user?.lastName}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* M25.4 — Loyalty card */}
        {loyalty && <LoyaltyCard loyalty={loyalty} />}

        {/* M25.3 — Notifications */}
        <Section title={`Notifications${unreadCount > 0 ? ` (${unreadCount} new)` : ''}`}>
          {(notifData?.notifications ?? []).slice(0, 3).map((n) => (
            <View key={n.id} style={[styles.notifItem, !n.isRead && styles.notifUnread]}>
              <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
              <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
            </View>
          ))}
          {(notifData?.notifications ?? []).length === 0 && (
            <Text style={styles.emptyNote}>No notifications yet</Text>
          )}
        </Section>

        {/* M25.6 — Saved addresses */}
        <Section title="Saved Addresses">
          {(addresses ?? []).map((addr) => (
            <View key={addr.id} style={styles.addrCard}>
              <View style={styles.addrInfo}>
                {addr.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
                <Text style={styles.addrStreet}>{addr.street}</Text>
                <Text style={styles.addrCity}>{addr.city}{addr.postalCode ? `, ${addr.postalCode}` : ''}</Text>
              </View>
              <View style={styles.addrActions}>
                {!addr.isDefault && (
                  <TouchableOpacity onPress={() => setDefaultMutation.mutate(addr.id)}>
                    <Text style={styles.addrActionText}>Set Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => Alert.alert('Delete Address', 'Remove this address?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteAddressMutation.mutate(addr.id) },
                  ])}
                >
                  <Text style={[styles.addrActionText, { color: COLORS.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {(addresses ?? []).length === 0 && (
            <Text style={styles.emptyNote}>No saved addresses</Text>
          )}
        </Section>

        {/* M25.5 — Loyalty history */}
        {loyalty && loyalty.history.length > 0 && (
          <Section title="Points History">
            {loyalty.history.slice(0, 5).map((h) => (
              <View key={h.id} style={styles.historyRow}>
                <Text style={styles.historyReason}>{h.reason ?? (h.type === 'EARNED' ? 'Points earned' : 'Points redeemed')}</Text>
                <Text style={[styles.historyPoints, { color: h.type === 'EARNED' ? COLORS.success : COLORS.danger }]}>
                  {h.type === 'EARNED' ? '+' : '-'}{h.points}
                </Text>
              </View>
            ))}
          </Section>
        )}

        {/* Account actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
            <Text style={styles.actionText}>Sign Out</Text>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sect.container}>
      <Text style={sect.title}>{title}</Text>
      {children}
    </View>
  )
}
const sect = StyleSheet.create({
  container: { marginBottom: 24 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
})

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.brand,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  profileEmail: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  notifItem: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    marginBottom: 8,
  },
  notifUnread: { borderLeftWidth: 3, borderLeftColor: COLORS.brand },
  notifTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  notifBody: { fontSize: 12, color: COLORS.muted, lineHeight: 17 },
  emptyNote: { fontSize: 13, color: COLORS.muted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
  addrCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  addrInfo: { flex: 1 },
  defaultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.brandLight,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  defaultBadgeText: { fontSize: 10, color: COLORS.brand, fontWeight: '700' },
  addrStreet: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  addrCity: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  addrActions: { gap: 8, alignItems: 'flex-end' },
  addrActionText: { fontSize: 12, color: COLORS.brand, fontWeight: '600' },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyReason: { fontSize: 13, color: COLORS.text, flex: 1 },
  historyPoints: { fontSize: 13, fontWeight: '700' },
  actions: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionText: { fontSize: 15, color: COLORS.danger, fontWeight: '600' },
  actionArrow: { fontSize: 15, color: COLORS.muted },
  signInPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  promptEmoji: { fontSize: 64, marginBottom: 16 },
  promptTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  promptSubtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  signInBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 14,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  signInBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  registerBtn: {
    borderWidth: 2,
    borderColor: COLORS.brand,
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  registerBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.brand },
})
