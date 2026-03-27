import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Lock, ArrowLeft, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { api, apiError } from '@/lib/api'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Must contain uppercase')
      .regex(/[0-9]/, 'Must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

const CHECKS = [
  { label: 'At least 8 characters',  test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter',    test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number',              test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character',   test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function strengthLevel(password: string): { score: number; label: string; color: string } {
  const passed = CHECKS.filter(c => c.test(password)).length
  if (!password) return { score: 0, label: '', color: '' }
  if (passed <= 1)  return { score: 1, label: 'Weak',   color: 'bg-red-500' }
  if (passed === 2) return { score: 2, label: 'Fair',   color: 'bg-amber-500' }
  if (passed === 3) return { score: 3, label: 'Good',   color: 'bg-blue-500' }
  return              { score: 4, label: 'Strong', color: 'bg-emerald-500' }
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [done, setDone] = useState(false)
  const token = searchParams.get('token') ?? ''

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const password = watch('password', '')
  const strength = strengthLevel(password)

  async function onSubmit(values: FormValues) {
    if (!token) { toast.error('Invalid reset link'); return }
    try {
      await api.post('/auth/reset-password', { token, password: values.password })
      setDone(true)
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  // ── Invalid / missing token ───────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
            <Lock size={28} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Link expired or invalid</h1>
            <p className="text-sm text-gray-500 mt-1">This reset link has expired or already been used.</p>
          </div>
          <Link
            to="/auth/forgot-password"
            className="inline-flex items-center gap-2 w-full justify-center py-2.5 bg-brand text-white rounded-xl font-medium text-sm hover:bg-brand/90 transition-colors"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    )
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4">
        <div className="w-full max-w-md text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Password updated!</h1>
            <p className="text-sm text-gray-500 mt-1">Your new password has been saved. You can now log in.</p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 bg-brand text-white rounded-xl font-medium text-sm hover:bg-brand/90 transition-colors"
          >
            Go to login
          </button>
        </div>
      </div>
    )
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Left — brand panel */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between bg-[#1A1D23] p-10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-sm">
            R
          </div>
          <span className="text-white font-semibold text-lg">RestroCloud</span>
        </div>
        <div className="space-y-4">
          <div className="w-12 h-12 bg-brand/20 rounded-2xl flex items-center justify-center">
            <Lock size={24} className="text-brand" />
          </div>
          <h2 className="text-2xl font-bold text-white leading-snug">
            Secure your account with a strong password
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Your password is encrypted and never stored in plain text. Use a unique password you don't use elsewhere.
          </p>
        </div>
        <p className="text-slate-600 text-xs">© {new Date().getFullYear()} RestroCloud. All rights reserved.</p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Logo (mobile only) */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-sm">R</div>
            <span className="font-semibold text-gray-900">RestroCloud</span>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
            <p className="text-sm text-gray-500">Choose a strong, unique password for your account.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* New password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="password">
                New password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••"
                  autoComplete="new-password"
                  {...register('password')}
                  className="w-full h-11 border border-gray-200 rounded-xl px-4 pr-11 text-sm outline-none focus:border-brand transition-colors bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength bar */}
              {password && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-1 h-1.5">
                    {[1, 2, 3, 4].map(n => (
                      <div
                        key={n}
                        className={`flex-1 rounded-full transition-all duration-300 ${
                          strength.score >= n ? strength.color : 'bg-gray-100'
                        }`}
                      />
                    ))}
                  </div>
                  {strength.label && (
                    <p className={`text-xs font-medium ${
                      strength.score <= 1 ? 'text-red-500' :
                      strength.score === 2 ? 'text-amber-500' :
                      strength.score === 3 ? 'text-blue-500' : 'text-emerald-500'
                    }`}>
                      {strength.label} password
                    </p>
                  )}
                </div>
              )}

              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Requirements checklist */}
            {password && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Requirements</p>
                {CHECKS.map(c => {
                  const ok = c.test(password)
                  return (
                    <div key={c.label} className="flex items-center gap-2.5">
                      {ok
                        ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                        : <Circle      size={14} className="text-gray-300 flex-shrink-0" />
                      }
                      <span className={`text-xs ${ok ? 'text-emerald-700' : 'text-gray-400'}`}>
                        {c.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Confirm password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700" htmlFor="confirmPassword">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••••"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  className="w-full h-11 border border-gray-200 rounded-xl px-4 pr-11 text-sm outline-none focus:border-brand transition-colors bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-brand hover:bg-brand/90 text-white font-medium text-sm rounded-xl transition-colors disabled:opacity-60"
            >
              {isSubmitting ? 'Saving…' : 'Set new password'}
            </button>
          </form>

          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <ArrowLeft size={14} />
            <Link to="/login" className="hover:text-brand transition-colors">Back to login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
