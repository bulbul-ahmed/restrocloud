import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, apiError } from '@/lib/api'
import { useAuthStore, type SuperAdminUser } from '@/store/auth.store'

interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: SuperAdminUser
}

const schema = z.object({
  identifier: z.string().min(1, 'Email is required'),
  password: z.string().min(6, 'Password required'),
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
      const { data: envelope } = await api.post<{ success: boolean; data: AuthResponse }>('/auth/login', values)
      const tokens = envelope.data

      // Fetch full profile to confirm SUPER_ADMIN role
      const { data: profileEnvelope } = await api.get<{ success: boolean; data: SuperAdminUser }>(
        '/auth/me',
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      )
      const user = profileEnvelope.data

      if (user.role !== 'SUPER_ADMIN') {
        toast.error('Access denied. Super Admin credentials required.')
        return
      }

      setAuth(tokens.accessToken, tokens.refreshToken, user)
      toast.success('Welcome, Super Admin!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand text-white">
            <ShieldCheck size={32} />
          </div>
          <div className="text-center">
            <h1 className="text-white text-2xl font-bold">RestroCloud</h1>
            <p className="text-slate-400 text-sm">Super Admin Portal</p>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-white">Sign in</CardTitle>
            <CardDescription className="text-slate-400">
              Super Admin access only
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-slate-300">Email</Label>
                <Input
                  id="identifier"
                  placeholder="admin@restrocloud.com"
                  autoComplete="username"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  {...register('identifier')}
                />
                {errors.identifier && (
                  <p className="text-xs text-red-400">{errors.identifier.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-brand hover:bg-brand-600"
                size="lg"
                loading={isSubmitting}
              >
                {isSubmitting ? 'Signing in…' : 'Sign in to Super Admin'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-slate-600 text-xs mt-6">
          RestroCloud Platform Administration • Restricted Access
        </p>
      </div>
    </div>
  )
}
