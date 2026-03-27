import React from 'react'
import { Text } from 'react-native'
import { Tabs } from 'expo-router'
import { useCartStore } from '../../src/store/cart.store'
import { COLORS } from '../../src/constants/colors'

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return (
    <Text style={{ fontSize: 22, opacity: color === COLORS.brand ? 1 : 0.45 }}>
      {emoji}
    </Text>
  )
}

export default function TabLayout() {
  const itemCount = useCartStore((s) => s.itemCount())

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.brand,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: COLORS.bg, borderBottomWidth: 0, elevation: 0, shadowOpacity: 0 },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color }) => <TabIcon emoji="🍽" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.brand, color: COLORS.white, fontSize: 10 },
          tabBarIcon: ({ color }) => <TabIcon emoji="🛒" color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => <TabIcon emoji="📦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
        }}
      />
    </Tabs>
  )
}
