import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { ApiError } from '@/core/api/api-error';
import { ROLE_HOME } from '@/core/rbac/roles';
import { isAppHost } from '@/core/env/host';
import { Alert, Button, IconButton, Input } from '@/components/ui';
import { AuthLayout } from './AuthLayout';

const schema = z.object({
  identifier: z.string().min(1, 'Enter your email or mobile number.'),
  password: z.string().min(1, 'Enter your password.'),
});

type FormValues = z.infer<typeof schema>;

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await signIn(values);
      // Return them to whatever they were trying to reach, or to their role's home.
      const intended = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;
      navigate(intended ?? ROLE_HOME[user.role], { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'Sign-in failed. Check your details and try again.',
      );
    }
  });

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use the email or mobile number registered to your account."
      footer={
        isAppHost() ? undefined : (
        <div className="space-y-1 text-step-0 text-ink-muted">
          <p>
            New to Yoo Bus?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
          <p>
            Run a bus company?{' '}
            <Link to="/become-an-operator" className="font-medium text-primary hover:underline">
              Become an operator
            </Link>
          </p>
        </div>
        )
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}

        <Input
          label="Email or mobile"
          placeholder="you@example.com"
          autoComplete="username"
          leftIcon={<Mail className="h-4 w-4" />}
          error={errors.identifier?.message}
          {...register('identifier')}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          leftIcon={<Lock className="h-4 w-4" />}
          error={errors.password?.message}
          rightSlot={
            <IconButton
              label={showPassword ? 'Hide password' : 'Show password'}
              type="button"
              size="sm"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </IconButton>
          }
          {...register('password')}
        />

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-step--1 text-primary hover:underline">
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" fullWidth size="lg" isLoading={isSubmitting} variant="primary">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
