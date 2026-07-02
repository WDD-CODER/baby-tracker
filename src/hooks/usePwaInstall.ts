import { useCallback, useEffect, useRef, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function detectStandaloneMode_() {
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function usePwaInstall() {
  const [canInstall_, setCanInstall_] = useState(false)
  const [isInstalled_, setIsInstalled_] = useState(false)
  const deferredPromptRef_ = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setIsInstalled_(detectStandaloneMode_())

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      deferredPromptRef_.current = event as BeforeInstallPromptEvent
      setCanInstall_(true)
    }

    const handleAppInstalled = () => {
      deferredPromptRef_.current = null
      setCanInstall_(false)
      setIsInstalled_(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const promptInstall_ = useCallback(async () => {
    const promptEvent = deferredPromptRef_.current
    if (!promptEvent) return false

    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice

    deferredPromptRef_.current = null
    setCanInstall_(false)

    if (outcome === 'accepted') {
      setIsInstalled_(true)
    }

    return outcome === 'accepted'
  }, [])

  return { canInstall_, isInstalled_, promptInstall_ }
}
