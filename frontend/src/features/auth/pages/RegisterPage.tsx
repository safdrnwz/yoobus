import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/app/providers/AuthProvider';
import { ApiError } from '@/core/api/api-error';
import { ROLE_HOME } from '@/core/rbac/roles';
import { Alert, Button, Checkbox, Input } from '@/components/ui';
import { authApi } from '../api/auth.api';
import { AuthLayout } from './AuthLayout';

/** Mirrors the backend's password policy, so the rule is stated before it's enforced. */
const passwordRule = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[0-9]/, 'Include a number.');

const detailsSchema = z.object({
  fullName: z.string().min(2, 'Enter your full name.'),
  email: z.string().email('Enter a valid email address.'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number.'),
  password: passwordRule,
  consentGiven: z.literal(true, { errorMap: () => ({ message: 'Accept the terms to continue.' }) }),
});

const otpSchema = z.object({ otp: z.string().length(6, 'Enter the 6-digit code.') });

type DetailsValues = z.infer<typeof detailsSchema>;
type OtpValues = z.infer<typeof otpSchema>;

/**
 * Registration is two steps, because the backend does not create the account until the
 * emailed OTP is confirmed — verifying the code is what creates the user and signs them in.
 */
export function RegisterPage() {
  const { adoptSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const detailsForm = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema) });
  const otpForm = useForm<OtpValues>({ resolver: zodResolver(otpSchema) });

  const submitDetails = detailsForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await authApi.register(values);
      setEmail(values.email);
      toast.success(result.message);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Registration failed. Try again.');
    }
  });

  const submitOtp = otpForm.handleSubmit(async (values) => {
    if (!email) return;
    setFormError(null);
    try {
      const session = await authApi.verifyEmail({ email, otp: values.otp });
      const user = await adoptSession(session);
      toast.success('Welcome to Yoo Bus.');
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'That code did not work. Try again.');
    }
  });

  const resend = async () => {
    if (!email) return;
    try {
      const result = await authApi.resendVerification(email);
      toast.success(result.message);
    } catch {
      toast.error('The code could not be resent.');
    }
  };

  if (email) {
    return (
      <AuthLayout
        title="Confirm your email"
        subtitle={`We sent a 6-digit code to ${email}. Enter it to finish creating your account.`}
      >
        <form onSubmit={submitOtp} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}

          <Input
            label="Verification code"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            placeholder="123456"
            className="tabular text-center text-step-2 tracking-[0.4em]"
            error={otpForm.formState.errors.otp?.message}
            {...otpForm.register('otp')}
          />

          <Button type="submit" fullWidth size="lg" isLoading={otpForm.formState.isSubmitting} variant="primary">
            Confirm and continue
          </Button>

          <div className="flex items-center justify-between text-step--1">
            <button type="button" onClick={resend} className="text-primary hover:underline">
              Resend the code
            </button>
            <button type="button" onClick={() => setEmail(null)} className="text-ink-muted hover:text-ink">
              Change your details
            </button>
          </div>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Book trips, track buses and manage your tickets."
      footer={
        <p className="text-step-0 text-ink-muted">
          Already registered?{' '}
          <Link to="/sign-in" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submitDetails} className="space-y-4" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}

        <Input label="Full name" autoComplete="name" error={detailsForm.formState.errors.fullName?.message} {...detailsForm.register('fullName')} />
        <Input label="Email" type="email" autoComplete="email" error={detailsForm.formState.errors.email?.message} {...detailsForm.register('email')} />
        <Input label="Mobile" inputMode="numeric" maxLength={10} placeholder="9876543210" error={detailsForm.formState.errors.phone?.message} {...detailsForm.register('phone')} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
          error={detailsForm.formState.errors.password?.message}
          {...detailsForm.register('password')}
        />

        <div>
          <Checkbox label="I agree to the terms of service and privacy policy." {...detailsForm.register('consentGiven')} />
          {detailsForm.formState.errors.consentGiven && (
            <p className="mt-1 text-step--1 text-danger">{detailsForm.formState.errors.consentGiven.message}</p>
          )}
        </div>

        <Button type="submit" fullWidth size="lg" isLoading={detailsForm.formState.isSubmitting} variant="primary">
          Send verification code
        </Button>
      </form>
    </AuthLayout>
  );
}
