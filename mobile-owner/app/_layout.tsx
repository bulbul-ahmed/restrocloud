import React, { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { useAuthStore } from '../src/store/auth.store'
import { queryClient } from '../src/store/query.client'
import { useNotificationSetup } from '../src/hooks/useNotificationSetup'
import { authApi } from '../src/lib/auth.api'
import { LoadingScreen } from '../src/components/LoadingScreen'

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
      if (!inAuth) router.replace('/(auth)/login')
      return
    }

    // Hydrate user if token exists but user not loaded
    if (!user) {
      authApi
        .getMe()
        .then((me) => {
          setAuth(accessToken, useAuthStore.getState().refreshToken ?? '', me)
        })
        .catch(() => {
          logout()
          router.replace('/(auth)/login')
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
      <StatusBar style="light" backgroundColor="#1A1D23" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="orders/[orderId]"
          options={{
            headerShown: true,
            headerTitle: 'Order Detail',
            headerStyle: { backgroundColor: '#1A1D23' },
            headerTintColor: '#F1F5F9',
          }}
        />
      </Stack>
    </QueryClientProvider>
  )
}
