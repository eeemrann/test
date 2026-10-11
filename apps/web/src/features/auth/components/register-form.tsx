import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getApiErrorMessage } from '@/lib/api'
import { authApi } from '@/features/auth/api/auth-api'

export function RegisterForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const email = form.email.trim().toLowerCase()
    if (form.fullName.trim().length < 2) return setError('Enter your full name.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(form.password)) return setError('Password must be at least 8 characters and include uppercase, lowercase, and a number.')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')

    setPending(true)
    try {
      await authApi.register({ ...form, fullName: form.fullName.trim(), email })
      setSubmitted(true)
    } catch (registrationError) {
      setError(getApiErrorMessage(registrationError))
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="w-full border-slate-200/80 bg-white/95 shadow-xl shadow-slate-200/40">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>Registration is reviewed by an administrator before access is enabled.</CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <div className="space-y-5 text-center">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">Registration submitted successfully. Your account is waiting for admin approval.</p>
            <Button className="w-full" onClick={() => navigate('/login')}>Back to sign in</Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p>}
            <div className="space-y-2"><label htmlFor="register-full-name" className="text-sm font-medium text-slate-700">Full name</label><Input id="register-full-name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} autoComplete="name" disabled={pending} required /></div>
            <div className="space-y-2"><label htmlFor="register-email" className="text-sm font-medium text-slate-700">Email</label><Input id="register-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" disabled={pending} required /></div>
            <div className="space-y-2"><label htmlFor="register-password" className="text-sm font-medium text-slate-700">Password</label><Input id="register-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" aria-describedby="register-password-help" disabled={pending} required /><p id="register-password-help" className="text-xs leading-5 text-slate-500">Use at least 8 characters with uppercase, lowercase, and a number.</p></div>
            <div className="space-y-2"><label htmlFor="register-confirm-password" className="text-sm font-medium text-slate-700">Confirm password</label><Input id="register-confirm-password" type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} autoComplete="new-password" disabled={pending} required /></div>
            <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Submitting…' : 'Submit registration'}</Button>
            <p className="text-center text-sm text-slate-500">Already registered? <Link className="font-medium text-blue-700 hover:underline" to="/login">Sign in</Link></p>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
