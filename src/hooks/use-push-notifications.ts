import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export type NotificationPermission = 'default' | 'granted' | 'denied'

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    // Check if browser supports notifications and service workers
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission as NotificationPermission)
      
      // Register service worker
      registerServiceWorker()
    }
  }, [])

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })
      console.log('Service Worker registered:', reg)
      setRegistration(reg)

      // Check if already subscribed
      const subscription = await (reg as any).pushManager?.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  }

  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result as NotificationPermission)

      if (result === 'granted') {
        toast.success('Notifications enabled!')
        return true
      } else if (result === 'denied') {
        toast.error('Notification permission denied')
        return false
      }
      return false
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      toast.error('Failed to request notification permission')
      return false
    }
  }, [isSupported])

  const subscribe = useCallback(async () => {
    if (!registration) {
      console.error('Service worker not registered')
      return null
    }

    try {
      // For demo purposes, we'll use a simple subscription
      // In production, you'd get the VAPID public key from your server
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: null, // Would use VAPID key in production
      })

      console.log('Push subscription:', subscription)
      setIsSubscribed(true)
      
      // In production, send this subscription to your server
      // await sendSubscriptionToServer(subscription)
      
      return subscription
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error)
      toast.error('Failed to enable push notifications')
      return null
    }
  }, [registration])

  const unsubscribe = useCallback(async () => {
    if (!registration) {
      return
    }

    try {
      const subscription = await (registration as any).pushManager?.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        setIsSubscribed(false)
        toast.success('Push notifications disabled')
        
        // In production, notify your server
        // await removeSubscriptionFromServer(subscription)
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error)
      toast.error('Failed to disable push notifications')
    }
  }, [registration])

  const showLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') {
      console.warn('Cannot show notification: permission not granted')
      return
    }

    if (!registration) {
      console.warn('Cannot show notification: service worker not registered')
      return
    }

    registration.showNotification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    })
  }, [permission, registration])

  return {
    permission,
    isSupported,
    isSubscribed,
    requestPermission,
    subscribe,
    unsubscribe,
    showLocalNotification,
  }
}
