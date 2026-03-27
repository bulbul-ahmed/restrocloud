import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Delete, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, apiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { TokenResponse, User } from '@/types/auth.types'

const MAX_PIN_LENGTH = 6
const MIN_PIN_LENGTH = 4

// In production, the restaurantId would come from the POS terminal config
// or URL param. Using the demo restaurant ID as default.
const DEFAULT_RESTAURANT_ID = import.meta.env.VITE_DEFAULT_RESTAURANT_ID ?? ''

export default function PinLoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  function appendDigit(digit: string) {
    if (pin.length < MAX_PIN_LENGTH) {
      setPin((p) => p + digit)
    }
  }

  function deleteDigit() {
    setPin((p) => p.slice(0, -1))
  }

  async function handleSubmit() {
    if (pin.length < MIN_PIN_LENGTH) {
      toast.error(`PIN must be at least ${MIN_PIN_LENGTH} digits`)
      return
    }

    const restaurantId = DEFAULT_RESTAURANT_ID
    if (!restaurantId) {
      toast.error('Restaurant ID not configured. Use email login instead.')
      return
    }

    setLoading(true)
    try {
      const { data: envelope } = await api.post<{ data: TokenResponse }>('/auth/pin-login', {
        restaurantId,
        pin,
      })
      const tokens = envelope.data
      const { data: profileEnvelope } = await api.get<{ data: User }>('/auth/me', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })
      const user = profileEnvelope.data
      setAuth(tokens.accessToken, tokens.refreshToken, user)
      toast.success(`Welcome, ${user.firstName}!`)
      navigate('/pos') // PIN users go directly to POS
    } catch (err) {
      toast.error(apiError(err))
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  const numPad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫'],
  ]

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand text-white font-bold text-lg">
            R
          </div>
          <span className="text-white text-xl font-semibold">POS Terminal</span>
        </div>

        <Card className="shadow-2xl bg-sidebar-active border-sidebar-border">
          <CardHeader className="items-center text-center space-y-1">
            <CardTitle className="text-xl font-bold text-white">Enter PIN</CardTitle>
            <CardDescription className="text-gray-400">
              4–6 digit POS PIN
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* PIN dots */}
            <div className="flex items-center justify-center gap-3 mb-8">
              {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-100 ${
                    i < pin.length
                      ? 'bg-brand scale-110'
                      : 'bg-sidebar-border'
                  }`}
                />
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {numPad.flat().map((key, idx) => {
                if (key === '') return <div key={idx} />
                if (key === '⌫') {
                  return (
                    <button
                      key={idx}
                      onClick={deleteDigit}
                      disabled={loading}
                      className="flex items-center justify-center h-14 rounded-xl text-gray-300 hover:bg-sidebar-hover active:bg-sidebar-bg transition-colors disabled:opacity-50"
                    >
                      <Delete size={20} />
                    </button>
                  )
                }
                return (
                  <button
                    key={idx}
                    onClick={() => appendDigit(key)}
                    disabled={loading}
                    className="flex items-center justify-center h-14 rounded-xl text-white text-xl font-semibold bg-sidebar-hover hover:bg-sidebar-active active:bg-sidebar-bg transition-colors disabled:opacity-50 select-none"
                  >
                    {key}
                  </button>
                )
              })}
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              loading={loading}
              disabled={pin.length < MIN_PIN_LENGTH}
            >
              {loading ? 'Verifying…' : 'Sign in'}
            </Button>

            <div className="mt-4 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={14} />
                Back to email login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
