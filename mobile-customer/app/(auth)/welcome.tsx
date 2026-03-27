// M25.1 — White-label welcome / landing screen
import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { COLORS } from '../../src/constants/colors'
import { CONFIG } from '../../src/constants/config'

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Brand hero */}
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>RC</Text>
          </View>
          <Text style={styles.brandName}>{CONFIG.brandName}</Text>
          <Text style={styles.tagline}>Order food, earn rewards</Text>
        </View>

        {/* Perks */}
        <View style={styles.perks}>
          {PERKS.map((p) => (
            <View key={p.icon} style={styles.perk}>
              <Text style={styles.perkIcon}>{p.icon}</Text>
              <View style={styles.perkText}>
                <Text style={styles.perkTitle}>{p.title}</Text>
                <Text style={styles.perkDesc}>{p.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTAs */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>Create Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnSecondaryText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnGuest}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnGuestText}>Browse as Guest</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const PERKS = [
  { icon: '🍔', title: 'Order Online', desc: 'Browse our full menu and order in seconds' },
  { icon: '⭐', title: 'Earn Rewards', desc: 'Collect loyalty points on every order' },
  { icon: '📦', title: 'Track Orders', desc: 'Real-time updates from kitchen to door' },
]

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { alignItems: 'center', marginTop: 40 },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: COLORS.brand,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  logoText: { fontSize: 32, fontWeight: '800', color: COLORS.white },
  brandName: { fontSize: 28, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: COLORS.muted, marginTop: 6 },
  perks: { gap: 16 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  perkIcon: { fontSize: 32, width: 44, textAlign: 'center' },
  perkText: { flex: 1 },
  perkTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  perkDesc: { fontSize: 13, color: COLORS.muted, lineHeight: 18 },
  actions: { gap: 10, paddingBottom: 8 },
  btnPrimary: {
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: COLORS.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimaryText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  btnSecondary: {
    borderWidth: 2,
    borderColor: COLORS.brand,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  btnSecondaryText: { fontSize: 16, fontWeight: '700', color: COLORS.brand },
  btnGuest: { padding: 12, alignItems: 'center' },
  btnGuestText: { fontSize: 14, color: COLORS.muted, textDecorationLine: 'underline' },
})
