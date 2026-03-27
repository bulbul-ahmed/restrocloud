import { useEffect, useRef } from 'react'
import * as Notifications from 'expo-notifications'
import { type EventSubscription } from 'expo-modules-core'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { pushApi } from '../lib/push.api'
import { CONFIG } from '../constants/config'

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
      if (!Device.isDevice) return

      const { status: existing } = await Notifications.getPermissionsAsync()
      let finalStatus = existing

      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }
      if (finalStatus !== 'granted') return

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: CONFIG.brandName,
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: CONFIG.brandColor,
        })
      }

      const projectId = CONFIG.easProjectId
      if (!projectId || projectId === 'your-eas-project-id') return

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
      pushToken.current = tokenData.data
      await pushApi.register(tokenData.data, Platform.OS === 'ios' ? 'ios' : 'android').catch(() => {})
    }

    registerPush()

    // Tap on notification → navigate to order tracking
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any>
      if (data?.orderId) {
        router.push(`/order/${data.orderId}` as any)
      }
    })

    return () => {
      responseListener.current?.remove()
      if (pushToken.current) {
        pushApi.deregister(pushToken.current).catch(() => {})
      }
    }
  }, [isAuthenticated, router])
}
