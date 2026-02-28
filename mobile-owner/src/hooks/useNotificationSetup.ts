import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { type EventSubscription } from 'expo-modules-core'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { pushApi } from '../lib/push.api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export function useNotificationSetup(isAuthenticated: boolean) {
  const router = useRouter()
  const responseListener = useRef<EventSubscription | null>(null)
  const pushToken = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return

    async function registerPush() {
      if (!Device.isDevice) return // skip simulator

      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') return

      // Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'RestroCloud',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#ff6b35',
        })
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId
      if (!projectId || projectId === 'your-eas-project-id') return // skip if not configured

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
      pushToken.current = tokenData.data

      await pushApi
        .register(tokenData.data, Platform.OS === 'ios' ? 'ios' : 'android')
        .catch(() => {}) // non-blocking
    }

    registerPush()

    // Handle tap on notification → navigate to order detail
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any>
      if (data?.orderId) {
        router.push(`/orders/${data.orderId}` as any)
      }
    })

    return () => {
      if (responseListener.current) {
        responseListener.current.remove()
      }
      // Deregister on unmount/logout
      if (pushToken.current) {
        pushApi.deregister(pushToken.current).catch(() => {})
      }
    }
  }, [isAuthenticated, router])
}
