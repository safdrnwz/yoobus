import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ApiError } from '@/core/api/api-error';
import { Alert, Button, Input } from '@/components/ui';
import { authApi } from '../api/auth.api';
import { AuthLayout } from './AuthLayout';

/**
 * Reset by OTP, which the backend sends to both the email and the mobile on the account.
 * That's why the field takes either one as the identifier.
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const requestForm = useForm<{ identifier: string }>();
  const resetForm = useForm<{ otp: string; newPassword: string }>();

  const request = requestForm.handleSubmit(async ({ identifier }) => {
    setFormError(null);
    try {
      const result = await authApi.forgotPasswordOtp(identifier);
      setSentTo(identifier);
      toast.success(result.message);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'That request could not be sent.');
    }
  });

  const reset = resetForm.handleSubmit(async ({ otp, newPassword }) => {
    if (!sentTo) return;
    setFormError(null);
    try {
      await authApi.resetPasswordOtp({ identifier: sentTo, otp, newPassword });
      toast.success('Password changed. Sign in with your new password.');
      navigate('/sign-in', { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'The password could not be changed.');
    }
  });

  return (
    <AuthLayout
      title={sentTo ? 'Set a new password' : 'Reset your password'}
      subtitle={
        sentTo
          ? `Enter the code we sent to ${sentTo}, then choose a new password.`
          : 'Enter the email or mobile number on your account and we will send you a code.'
      }
      footer={
        <Link to="/sign-in" className="text-step-0 text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sentTo ? (
        <form onSubmit={reset} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Input
            label="Verification code"
            inputMode="numeric"
            maxLength={6}
            className="tabular tracking-[0.3em]"
            {...resetForm.register('otp', { required: true })}
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
            {...resetForm.register('newPassword', { required: true })}
          />
          <Button type="submit" fullWidth size="lg" isLoading={resetForm.formState.isSubmitting} variant="primary">
            Change password
          </Button>
        </form>
      ) : (
        <form onSubmit={request} className="space-y-4" noValidate>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <Input label="Email or mobile" placeholder="you@example.com" {...requestForm.register('identifier', { required: true })} />
          <Button type="submit" fullWidth size="lg" isLoading={requestForm.formState.isSubmitting} variant="primary">
            Send code
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
