import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, apiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { TokenResponse, User } from '@/types/auth.types'

const schema = z.object({
  code: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Digits only'),
})

type FormValues = z.infer<typeof schema>

export default function TwoFactorPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const pendingToken: string | undefined = location.state?.pendingToken

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (!pendingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-muted px-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle>Session expired</CardTitle>
            <CardDescription>Please log in again.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login">
              <Button className="w-full">Back to login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  async function onSubmit(values: FormValues) {
    try {
      const { data: envelope } = await api.post<{ data: TokenResponse }>('/auth/2fa/verify', {
        pendingToken,
        code: values.code,
      })
      const tokens = envelope.data
      const { data: profileEnvelope } = await api.get<{ data: User }>('/auth/me', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })
      const user = profileEnvelope.data
      setAuth(tokens.accessToken, tokens.refreshToken, user)
      toast.success(`Welcome, ${user.firstName}!`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand text-white font-bold">
            R
          </div>
          <span className="text-gray-900 text-xl font-semibold">RestroCloud</span>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="items-center text-center space-y-1">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-brand/10 mb-2">
              <ShieldCheck size={28} className="text-brand" />
            </div>
            <CardTitle className="text-2xl font-bold">Two-factor verification</CardTitle>
            <CardDescription>
              Enter the 6-digit code from your authenticator app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Authenticator code</Label>
                <Input
                  id="code"
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="text-center text-2xl tracking-widest font-mono h-14"
                  {...register('code')}
                />
                {errors.code && (
                  <p className="text-xs text-destructive text-center">{errors.code.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                {isSubmitting ? 'Verifying…' : 'Verify'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
              >
                <ArrowLeft size={14} />
                Use a different account
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
