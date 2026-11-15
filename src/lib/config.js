import { useEffect, useState } from 'react'
import { api } from './api'

// Public runtime config from the server (e.g. whether demo mode is on).
let cached
const load = () => (cached ??= api('/config').catch(() => ({ demoMode: false })))

export function useConfig() {
  const [config, setConfig] = useState(null)
  useEffect(() => {
    let live = true
    load().then((c) => live && setConfig(c))
    return () => {
      live = false
    }
  }, [])
  return config
}
