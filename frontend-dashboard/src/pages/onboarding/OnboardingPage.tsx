import { useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { settingsApi } from '@/lib/settings.api'
import { Button } from '@/components/ui/button'

const Step1Profile  = lazy(() => import('./steps/Step1Profile'))
const Step2Config   = lazy(() => import('./steps/Step2Config'))
const Step3Channels = lazy(() => import('./steps/Step3Channels'))

const STEPS = [
  { number: 1, label: 'Restaurant Profile' },
  { number: 2, label: 'Business Config' },
  { number: 3, label: 'Order Channels' },
]

function StepLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg className="animate-spin h-6 w-6 text-brand" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}

export default function OnboardingPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const rid = user?.restaurantId ?? ''

  const [step, setStep] = useState(1) // 1-3, 4 = completion
  const [done, setDone] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', rid],
    queryFn: () => settingsApi.get(rid),
    enabled: !!rid,
  })

  function markDone() {
    if (rid) localStorage.setItem(`onboarding_done_${rid}`, '1')
    navigate('/dashboard')
  }

  function handleStepDone() {
    if (step < 3) {
      setStep((s) => s + 1)
    } else {
      setDone(true)
    }
  }

  function handleSkipAll() {
    if (rid) localStorage.setItem(`onboarding_done_${rid}`, '1')
    navigate('/dashboard')
  }

  const restaurantName = settings?.name ?? user?.restaurantName ?? 'your restaurant'

  if (isLoading || !settings) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center">
        <StepLoader />
      </div>
    )
  }

  // ── Completion screen ──
  if (done) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          {/* Brand */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand text-white font-bold">R</div>
            <span className="text-gray-900 text-xl font-semibold">RestroCloud</span>
          </div>

          {/* Confetti-style card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-emerald-500">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              You're all set, {restaurantName}! 🎉
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              Your restaurant is configured and ready to go. Here's what to do next:
            </p>

            {/* Quick-start cards */}
            <div className="grid grid-cols-1 gap-3 mb-8">
              {[
                {
                  to: '/menu/items',
                  emoji: '🍽️',
                  label: 'Add Menu Items',
                  desc: 'Add your dishes, prices, and modifiers',
                },
                {
                  to: '/tables',
                  emoji: '🪑',
                  label: 'Set Up Tables',
                  desc: 'Create floor sections and table layout',
                },
                {
                  to: '/staff',
                  emoji: '👥',
                  label: 'Invite Staff',
                  desc: 'Add waiters, cashiers, and kitchen staff',
                },
              ].map(({ to, emoji, label, desc }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => { if (rid) localStorage.setItem(`onboarding_done_${rid}`, '1') }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-brand hover:bg-orange-50/30 text-left transition-all group"
                >
                  <span className="text-2xl shrink-0">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-brand transition-colors shrink-0" />
                </Link>
              ))}
            </div>

            <Button onClick={markDone} className="w-full" size="lg">
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Wizard ──
  return (
    <div className="min-h-screen bg-surface-muted flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Brand + skip */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand text-white font-bold">R</div>
            <span className="text-gray-900 text-xl font-semibold">RestroCloud</span>
          </div>
          <button
            type="button"
            onClick={handleSkipAll}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={14} />
            Skip setup
          </button>
        </div>

        {/* Step tracker */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.number} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    s.number < step
                      ? 'bg-emerald-500 text-white'
                      : s.number === step
                      ? 'bg-brand text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s.number < step ? (
                    <svg viewBox="0 0 10 8" fill="none" className="w-4 h-4">
                      <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    s.number
                  )}
                </div>
                <span className={`text-xs mt-1 font-medium ${s.number === step ? 'text-brand' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 mb-4 transition-colors ${
                    s.number < step ? 'bg-emerald-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {STEPS[step - 1].label}
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Step {step} of {STEPS.length}
          </p>

          <Suspense fallback={<StepLoader />}>
            {step === 1 && (
              <Step1Profile
                restaurantId={rid}
                settings={settings}
                onDone={handleStepDone}
                onSkip={handleStepDone}
              />
            )}
            {step === 2 && (
              <Step2Config
                restaurantId={rid}
                settings={settings}
                onDone={handleStepDone}
                onSkip={handleStepDone}
              />
            )}
            {step === 3 && (
              <Step3Channels
                restaurantId={rid}
                settings={settings}
                onDone={handleStepDone}
                onSkip={handleStepDone}
              />
            )}
          </Suspense>
        </div>

        {/* Progress */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Your data is saved automatically — you can return to Settings anytime to update these.
        </p>
      </div>
    </div>
  )
}
