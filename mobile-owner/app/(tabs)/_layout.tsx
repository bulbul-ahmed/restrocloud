import React from 'react'
import { Tabs } from 'expo-router'
import { COLORS } from '../../src/constants/colors'

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  // Simple text-based icons — no icon library needed
  const icons: Record<string, string> = {
    index: '📊',
    orders: '📋',
    inventory: '📦',
    menu: '🍽',
  }
  return null // expo-router handles the icon slot; we use tabBarIcon below
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.brand,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: COLORS.bg },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => <TabIcon emoji="📊" color={color} />,
          headerTitle: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarLabel: 'Orders',
          tabBarIcon: ({ color }) => <TabIcon emoji="📋" color={color} />,
          headerTitle: 'Orders',
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Low Stock',
          tabBarLabel: 'Low Stock',
          tabBarIcon: ({ color }) => <TabIcon emoji="📦" color={color} />,
          headerTitle: 'Low Stock Alerts',
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarLabel: 'Menu',
          tabBarIcon: ({ color }) => <TabIcon emoji="🍽" color={color} />,
          headerTitle: 'Quick Menu Toggle',
        }}
      />
    </Tabs>
  )
}

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  const { Text } = require('react-native')
  return <Text style={{ fontSize: 20, opacity: color === COLORS.brand ? 1 : 0.5 }}>{emoji}</Text>
}
