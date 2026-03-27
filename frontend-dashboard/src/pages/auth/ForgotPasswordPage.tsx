import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api, apiError } from '@/lib/api'

const schema = z.object({
  email: z.string().email('Valid email required'),
})

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    try {
      await api.post('/auth/forgot-password', values)
      setSent(true)
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
          {sent ? (
            <>
              <CardHeader className="items-center text-center space-y-1 pb-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 mb-2">
                  <Mail size={28} className="text-emerald-600" />
                </div>
                <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
                <CardDescription>
                  We&apos;ve sent a password reset link to{' '}
                  <span className="font-medium text-gray-700">{getValues('email')}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-gray-500 mb-6">
                  Didn&apos;t receive it? Check your spam folder or{' '}
                  <button
                    onClick={() => setSent(false)}
                    className="text-brand hover:underline font-medium"
                  >
                    try again
                  </button>
                  .
                </p>
                <Link to="/login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft size={16} />
                    Back to login
                  </Button>
                </Link>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold">Forgot password?</CardTitle>
                <CardDescription>
                  Enter your email and we&apos;ll send you a reset link
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="owner@restaurant.com"
                      autoComplete="email"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                    {isSubmitting ? 'Sending…' : 'Send reset link'}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
                  >
                    <ArrowLeft size={14} />
                    Back to login
                  </Link>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
