import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, LoaderCircle, Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError, getCurrentUser, requestOtp, verifyOtp } from '@/lib/api'

interface VerifyLocationState {
  email?: string
  expiresAt?: number
  resendAt?: number
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function useCountdown(expiresAt: number, resendAt: number) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return {
    expiresIn: Math.max(0, Math.ceil((expiresAt - now) / 1000)),
    resendIn: Math.max(0, Math.ceil((resendAt - now) / 1000)),
  }
}

function AuthCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: ReactNode
  children: ReactNode
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center pb-4 pt-8 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            {icon}
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent className="space-y-5 pb-8">{children}</CardContent>
      </Card>
    </main>
  )
}

function AuthError({ children }: { children: ReactNode }) {
  return (
    <p
      className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
      role="alert"
    >
      {children}
    </p>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const sessionQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 30_000,
  })
  const requestMutation = useMutation({
    mutationFn: requestOtp,
    onSuccess: (result, submittedEmail) => {
      const state = {
        email: submittedEmail,
        expiresAt: Date.now() + result.expiresInSeconds * 1000,
        resendAt: Date.now() + result.resendAfterSeconds * 1000,
      } satisfies VerifyLocationState
      sessionStorage.setItem('sprintly.auth.email', submittedEmail)
      sessionStorage.setItem('sprintly.auth.expiresAt', String(state.expiresAt))
      sessionStorage.setItem('sprintly.auth.resendAt', String(state.resendAt))
      navigate('/verify-otp', { state })
    },
  })

  if (sessionQuery.isSuccess) {
    return <Navigate to="/dashboard" replace />
  }

  const errorMessage =
    requestMutation.error instanceof Error
      ? requestMutation.error.message
      : undefined

  return (
    <AuthCard
      icon={<Mail aria-hidden="true" size={22} />}
      title="Sign in to Sprintly"
      description="Enter your approved work email and we’ll send you a one-time verification code."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          requestMutation.mutate(email.trim())
        }}
      >
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Work email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            className="flex h-11 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {errorMessage && <AuthError>{errorMessage}</AuthError>}
        <Button type="submit" className="w-full" disabled={requestMutation.isPending}>
          {requestMutation.isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
          ) : (
            <Mail aria-hidden="true" size={17} />
          )}
          Send verification code
        </Button>
      </form>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        Access is limited to members approved by your administrator.
      </p>
    </AuthCard>
  )
}

export function VerifyOtpPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const state = (location.state ?? {}) as VerifyLocationState
  const email =
    state.email ?? sessionStorage.getItem('sprintly.auth.email') ?? undefined
  const [code, setCode] = useState('')
  const initialExpiresAt = Number(
    state.expiresAt ?? sessionStorage.getItem('sprintly.auth.expiresAt'),
  )
  const initialResendAt = Number(
    state.resendAt ?? sessionStorage.getItem('sprintly.auth.resendAt'),
  )
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt)
  const [resendAt, setResendAt] = useState(initialResendAt)
  const countdown = useCountdown(expiresAt, resendAt)

  const resendMutation = useMutation({
    mutationFn: () => requestOtp(email ?? ''),
    onSuccess: (result) => {
      const nextExpiry = Date.now() + result.expiresInSeconds * 1000
      const nextResend = Date.now() + result.resendAfterSeconds * 1000
      setExpiresAt(nextExpiry)
      setResendAt(nextResend)
      setCode('')
      sessionStorage.setItem('sprintly.auth.expiresAt', String(nextExpiry))
      sessionStorage.setItem('sprintly.auth.resendAt', String(nextResend))
    },
  })
  const verifyMutation = useMutation({
    mutationFn: () => verifyOtp(email ?? '', code),
    onSuccess: ({ user }) => {
      sessionStorage.removeItem('sprintly.auth.email')
      sessionStorage.removeItem('sprintly.auth.expiresAt')
      sessionStorage.removeItem('sprintly.auth.resendAt')
      queryClient.setQueryData(['auth', 'me'], user)
      navigate('/dashboard', { replace: true })
    },
  })

  if (!email || !Number.isFinite(expiresAt) || !Number.isFinite(resendAt)) {
    return <Navigate to="/login" replace />
  }

  const verifyError =
    verifyMutation.error instanceof ApiError
      ? verifyMutation.error.message
      : verifyMutation.error instanceof Error
        ? verifyMutation.error.message
        : undefined
  const resendError =
    resendMutation.error instanceof Error
      ? resendMutation.error.message
      : undefined

  return (
    <AuthCard
      icon={<ShieldCheck aria-hidden="true" size={22} />}
      title="Check your email"
      description={
        <>
          Enter the 6-digit code sent to <strong className="font-medium text-foreground">{email}</strong>.
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          verifyMutation.mutate()
        }}
      >
        <div className="space-y-2">
          <label htmlFor="otp" className="text-sm font-medium">
            Verification code
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            required
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="flex h-12 w-full rounded-md border bg-background px-3 py-2 text-center font-mono text-lg tracking-[0.4em] outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {verifyError && <AuthError>{verifyError}</AuthError>}
        {resendError && <AuthError>{resendError}</AuthError>}
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {countdown.expiresIn > 0
            ? `Code expires in ${formatCountdown(countdown.expiresIn)}`
            : 'This code has expired. Request a new one.'}
        </p>
        <Button
          type="submit"
          className="w-full"
          disabled={code.length !== 6 || countdown.expiresIn === 0 || verifyMutation.isPending}
        >
          {verifyMutation.isPending && (
            <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
          )}
          Verify and sign in
        </Button>
      </form>
      <div className="flex items-center justify-between text-sm">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" size={15} />
          Change email
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={countdown.resendIn > 0 || resendMutation.isPending}
          onClick={() => resendMutation.mutate()}
        >
          {resendMutation.isPending
            ? 'Sending…'
            : countdown.resendIn > 0
              ? `Resend in ${countdown.resendIn}s`
              : 'Resend code'}
        </Button>
      </div>
    </AuthCard>
  )
}
