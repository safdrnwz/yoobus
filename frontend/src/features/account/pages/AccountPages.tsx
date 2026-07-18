import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, Button, Card, CardBody, CardHeader, DetailRow, Input } from '@/components/ui';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAuthStore } from '@/core/auth/auth.store';
import { ApiError } from '@/core/api/api-error';
import { ROLE_LABELS } from '@/core/rbac/roles';
import { authApi } from '@/features/auth/api/auth.api';

export function AccountPage() {
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions);

  return (
    <>
      <PageHeader title="Your account" description="Who you are on Yoo Bus." breadcrumbs={[{ label: 'Account' }]} />

      <div className="grid gap-gutter lg:grid-cols-2">
        <Card>
          <CardHeader title="Details" />
          <CardBody>
            <dl>
              <DetailRow label="Name">{user?.fullName ?? '—'}</DetailRow>
              <DetailRow label="Email">{user?.email ?? '—'}</DetailRow>
              <DetailRow label="Role">{user ? ROLE_LABELS[user.role] : '—'}</DetailRow>
              <DetailRow label="Operator">
                {user?.operatorId ? (
                  <span className="tabular">{user.operatorId.slice(0, 8)}</span>
                ) : (
                  <span className="text-ink-muted">Platform (no operator)</span>
                )}
              </DetailRow>
              <DetailRow label="Permissions granted">
                <span className="tabular">{permissions.size}</span>
              </DetailRow>
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export function SecurityPage() {
  const { signOutEverywhere } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<{ oldPassword: string; newPassword: string; confirm: string }>();

  const change = useMutation({
    mutationFn: (values: { oldPassword: string; newPassword: string }) => authApi.changePassword(values),
    onSuccess: () => {
      form.reset();
      toast.success('Password changed.');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'The password could not be changed.'),
  });

  const submit = form.handleSubmit((values) => {
    setError(null);
    if (values.newPassword !== values.confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    change.mutate({ oldPassword: values.oldPassword, newPassword: values.newPassword });
  });

  return (
    <>
      <PageHeader
        title="Password & security"
        description="Change your password, or sign out everywhere if you think someone else has it."
        breadcrumbs={[{ label: 'Account' }, { label: 'Security' }]}
      />

      <div className="grid gap-gutter lg:grid-cols-2">
        <Card>
          <CardHeader title="Change your password" />
          <CardBody>
            <form onSubmit={submit} className="space-y-4" noValidate>
              {error && <Alert tone="danger">{error}</Alert>}
              <Input
                label="Current password"
                type="password"
                autoComplete="current-password"
                {...form.register('oldPassword', { required: true })}
              />
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
                {...form.register('newPassword', { required: true })}
              />
              <Input
                label="Confirm the new password"
                type="password"
                autoComplete="new-password"
                {...form.register('confirm', { required: true })}
              />
              <Button type="submit" isLoading={change.isPending}>
                Change password
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardHeader
            title="Sessions"
            description="Signing out everywhere ends every session on every device, including this one."
          />
          <CardBody>
            <Button
              variant="danger"
              leftIcon={<LogOut className="h-4 w-4" />}
              onClick={async () => {
                await signOutEverywhere();
                window.location.href = '/sign-in';
              }}
            >
              Sign out everywhere
            </Button>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
