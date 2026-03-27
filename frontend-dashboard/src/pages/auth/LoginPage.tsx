import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, apiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { isTwoFactorPending, type LoginResponse, type User } from '@/types/auth.types'

const schema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    try {
      const { data: envelope } = await api.post<{ data: LoginResponse }>('/auth/login', values)
      const data = envelope.data

      if (isTwoFactorPending(data)) {
        navigate('/auth/2fa', { state: { pendingToken: data.pendingToken } })
        return
      }

      const { data: profileEnvelope } = await api.get<{ data: User }>('/auth/me', {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      })
      const user = profileEnvelope.data
      setAuth(data.accessToken, data.refreshToken, user)
      toast.success(`Welcome back, ${user.firstName}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar-bg flex-col justify-center px-16">
        <div className="max-w-md">
          <div className="flex items-center gap-3 mb-12">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand text-white font-bold text-lg">
              R
            </div>
            <span className="text-white text-xl font-semibold">RestroCloud</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Restaurant management,<br />
            <span className="text-brand">simplified.</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            POS, Kitchen Display, Table Management, and full restaurant analytics — all in one platform.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-6">
            {[
              { label: 'Orders / day', value: '1,200+' },
              { label: 'Avg. ticket time', value: '8 min' },
              { label: 'Restaurants', value: '500+' },
              { label: 'Uptime SLA', value: '99.9%' },
            ].map((stat) => (
              <div key={stat.label} className="bg-sidebar-active rounded-xl p-4">
                <p className="text-brand text-2xl font-bold">{stat.value}</p>
                <p className="text-gray-400 text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auth form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-surface-muted">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2 mb-8 lg:hidden">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand text-white font-bold">
              R
            </div>
            <span className="text-gray-900 text-xl font-semibold">RestroCloud</span>
          </div>

          <Card className="shadow-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
              <CardDescription>Enter your email or phone and password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or Phone</Label>
                  <Input
                    id="identifier"
                    placeholder="owner@restaurant.com"
                    autoComplete="username"
                    {...register('identifier')}
                  />
                  {errors.identifier && (
                    <p className="text-xs text-destructive">{errors.identifier.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      to="/auth/forgot-password"
                      className="text-xs text-brand hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  loading={isSubmitting}
                >
                  {isSubmitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>

              <div className="mt-4 flex flex-col gap-3">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-400">or</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/auth/pin')}
                >
                  Sign in with PIN (POS)
                </Button>
              </div>

              <p className="mt-6 text-center text-sm text-gray-500">
                Don&apos;t have an account?{' '}
                <Link to="/auth/register" className="text-brand font-medium hover:underline">
                  Create restaurant
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
