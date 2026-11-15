import { useConfig } from '../lib/config'

// Shown on every page while the server runs with DEMO_MODE=true.
export default function DemoBanner() {
  const config = useConfig()
  if (!config?.demoMode) return null
  return (
    <div className="bg-ink px-4 py-2 text-center text-sm font-semibold text-white">
      Demo only — addresses aren’t real wallets and gift cards aren’t real. Don’t send real crypto.
    </div>
  )
}
