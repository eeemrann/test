import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RegisterForm } from '@/features/auth/components/register-form'

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  getApiErrorMessage: vi.fn(() => 'An account with this email already exists'),
}))

vi.mock('@/features/auth/api/auth-api', () => ({ authApi: { register: mocks.register } }))
vi.mock('@/lib/api', () => ({ getApiErrorMessage: mocks.getApiErrorMessage }))

function renderForm() {
  return render(
    <MemoryRouter>
      <RegisterForm />
    </MemoryRouter>,
  )
}

describe('registration form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.register.mockResolvedValue({ message: 'Registration submitted' })
  })

  it('validates password confirmation before calling the backend', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Full name'), 'New Employee')
    await user.type(screen.getByLabelText('Email'), 'new@office.local')
    await user.type(screen.getByLabelText('Password'), 'Strong.Password.123')
    await user.type(screen.getByLabelText('Confirm password'), 'Different.Password.123')
    await user.click(screen.getByRole('button', { name: 'Submit registration' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it('submits a registration and shows the pending approval feedback', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText('Full name'), '  New Employee  ')
    await user.type(screen.getByLabelText('Email'), 'NEW@OFFICE.LOCAL')
    await user.type(screen.getByLabelText('Password'), 'Strong.Password.123')
    await user.type(screen.getByLabelText('Confirm password'), 'Strong.Password.123')
    await user.click(screen.getByRole('button', { name: 'Submit registration' }))

    expect(mocks.register).toHaveBeenCalledWith({
      fullName: 'New Employee',
      email: 'new@office.local',
      password: 'Strong.Password.123',
      confirmPassword: 'Strong.Password.123',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('waiting for admin approval')
  })

  it('keeps the form usable and reports duplicate-email errors', async () => {
    const user = userEvent.setup()
    mocks.register.mockRejectedValueOnce(new Error('duplicate'))
    renderForm()

    await user.type(screen.getByLabelText('Full name'), 'Duplicate Employee')
    await user.type(screen.getByLabelText('Email'), 'duplicate@office.local')
    await user.type(screen.getByLabelText('Password'), 'Strong.Password.123')
    await user.type(screen.getByLabelText('Confirm password'), 'Strong.Password.123')
    await user.click(screen.getByRole('button', { name: 'Submit registration' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists')
    expect(screen.getByLabelText('Full name')).toHaveValue('Duplicate Employee')
  })
})
