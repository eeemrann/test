import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, LockKeyhole, TriangleAlert } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/hooks/use-auth'

type LoginLocationState = {
  from?: string
  logoutWarning?: string
}

function getSafeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/app'
  }

  return value
}

export function LoginForm() {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const locationState = location.state as LoginLocationState | null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setValidationError(null)

    const normalizedEmail = email.trim().toLowerCase()

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setValidationError('Enter a valid email address.')
      return
    }

    if (!password) {
      setValidationError('Enter your password.')
      return
    }

    const success = await auth.login({ email: normalizedEmail, password })

    if (success) {
      navigate(getSafeRedirect(locationState?.from), { replace: true })
    }
  }

  const errorMessage = validationError ?? auth.error ?? locationState?.logoutWarning

  return (
    <Card className="w-full border-slate-200/80 bg-white/95 shadow-xl shadow-slate-200/40">
      <CardHeader className="space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to continue to your office workspace.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {errorMessage && (
            <div role="alert" className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="login-email" className="text-sm font-medium text-slate-700">Email</label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@office.local"
              aria-invalid={Boolean(validationError && !email)}
              disabled={auth.isLoggingIn}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="login-password" className="text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="pr-11"
                aria-invalid={Boolean(validationError && !password)}
                disabled={auth.isLoggingIn}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={auth.isLoggingIn ? -1 : 0}
              >
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={auth.isLoggingIn}>
            {auth.isLoggingIn ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
