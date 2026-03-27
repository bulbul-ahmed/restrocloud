import React, { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { useAuthStore } from '../src/store/auth.store'
import { queryClient } from '../src/store/query.client'
import { useNotificationSetup } from '../src/hooks/useNotificationSetup'
import { authApi } from '../src/lib/auth.api'
import { LoadingScreen } from '../src/components/LoadingScreen'
import { COLORS } from '../src/constants/colors'

function AuthGuard() {
  const { accessToken, user, isLoaded, loadFromStorage, setAuth, logout } = useAuthStore()
  const router = useRouter()
  const segments = useSegments()

  useNotificationSetup(!!accessToken && !!user)

  useEffect(() => {
    loadFromStorage()
  }, [])

  useEffect(() => {
    if (!isLoaded) return

    const inAuth = segments[0] === '(auth)'

    if (!accessToken) {
      // Allow unauthenticated browsing — only redirect if in a protected area
      if (!inAuth && segments[0] !== '(tabs)') {
        router.replace('/(tabs)')
      }
      return
    }

    // Hydrate user if token exists but user not loaded
    if (!user) {
      authApi
        .getMe()
        .then((me) => setAuth(accessToken, me))
        .catch(() => {
          logout()
        })
      return
    }

    if (inAuth) {
      router.replace('/(tabs)')
    }
  }, [accessToken, user, isLoaded, segments])

  if (!isLoaded) return <LoadingScreen />

  return null
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" backgroundColor={COLORS.bg} />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="item/[itemId]"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Item',
            headerStyle: { backgroundColor: COLORS.bg },
            headerTintColor: COLORS.text,
          }}
        />
        <Stack.Screen
          name="order/[orderId]"
          options={{
            headerShown: true,
            headerTitle: 'Order Tracking',
            headerStyle: { backgroundColor: COLORS.bg },
            headerTintColor: COLORS.text,
            headerTitleStyle: { fontWeight: '700' },
          }}
        />
        <Stack.Screen
          name="checkout"
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Checkout',
            headerStyle: { backgroundColor: COLORS.bg },
            headerTintColor: COLORS.text,
            headerTitleStyle: { fontWeight: '700' },
          }}
        />
      </Stack>
    </QueryClientProvider>
  )
}
