import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, CheckCircle2, Send } from 'lucide-react';
import { AuthLayout } from '@/features/auth/pages/AuthLayout';
import { Button } from '@/components/ui';
import { ApiError } from '@/core/api/api-error';
import type { CreateLeadDto } from '@/core/api/generated/dtos';
import { onboardingApi } from '../api/onboarding.api';

// ---- attractive field styling ----
const base =
  'w-full rounded-xl border bg-surface px-3.5 py-2.5 text-step-0 text-ink placeholder:text-ink-muted/50 outline-none transition-all duration-150 focus:ring-4 focus:ring-brand/15';
const ok = 'border-line hover:border-ink-muted/40 focus:border-brand';
const bad = 'border-red-400 focus:border-red-400 focus:ring-red-100';
const labelClass = 'mb-1.5 block text-step--1 font-medium text-ink';

interface FormState {
  companyName: string; contactName: string; email: string; mobile: string;
  totalBuses: string; city: string; details: string;
  legalName: string; gstin: string; pan: string;
  addrLine1: string; addrCity: string; addrState: string; addrPincode: string;
  bankName: string; accountNumber: string; ifsc: string;
  docGst: string; docPan: string; docCheque: string;
}
type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = {
  companyName: '', contactName: '', email: '', mobile: '', totalBuses: '', city: '', details: '',
  legalName: '', gstin: '', pan: '',
  addrLine1: '', addrCity: '', addrState: '', addrPincode: '',
  bankName: '', accountNumber: '', ifsc: '',
  docGst: '', docPan: '', docCheque: '',
};

const RX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  mobile: /^[0-9]{10}$/,
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  pincode: /^[0-9]{6}$/,
  url: /^https?:\/\/.+/i,
};

/** Every field is validated on the client; the backend validates again and is the source of truth. */
function validate(f: FormState): Errors {
  const e: Errors = {};
  if (f.companyName.trim().length < 2) e.companyName = 'Company name is required.';
  if (f.contactName.trim().length < 2) e.contactName = 'Contact name is required.';
  if (!RX.email.test(f.email.trim())) e.email = 'Enter a valid email address.';
  if (!RX.mobile.test(f.mobile.trim())) e.mobile = 'Enter a 10-digit mobile number.';
  const buses = Number(f.totalBuses);
  if (!Number.isInteger(buses) || buses < 1) e.totalBuses = 'Enter how many buses you run (at least 1).';
  if (!f.gstin.trim()) e.gstin = 'GSTIN is required.';
  else if (!RX.gstin.test(f.gstin.trim())) e.gstin = 'That doesn’t look like a valid GSTIN (e.g. 07ABCDE1234F1Z5).';
  if (!f.pan.trim()) e.pan = 'PAN is required.';
  else if (!RX.pan.test(f.pan.trim())) e.pan = 'That doesn’t look like a valid PAN (e.g. ABCDE1234F).';
  if (f.ifsc.trim() && !RX.ifsc.test(f.ifsc.trim())) e.ifsc = 'That doesn’t look like a valid IFSC (e.g. HDFC0001234).';
  if (f.addrPincode.trim() && !RX.pincode.test(f.addrPincode.trim())) e.addrPincode = 'Pincode must be 6 digits.';
  for (const k of ['docGst', 'docPan', 'docCheque'] as const) {
    if (f[k].trim() && !RX.url.test(f[k].trim())) e[k] = 'Enter a valid link (starting with http).';
  }
  return e;
}

export function OperatorApplyPage() {
  const [f, setF] = useState<FormState>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);

  const errors = useMemo(() => ({ ...validate(f), ...serverErrors }), [f, serverErrors]);
  const hasErrors = Object.keys(errors).length > 0;

  const upper = new Set<keyof FormState>(['gstin', 'pan', 'ifsc']);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = upper.has(k) ? e.target.value.toUpperCase() : e.target.value;
    setF((s) => ({ ...s, [k]: v }));
    if (serverErrors[k]) setServerErrors((s) => ({ ...s, [k]: undefined }));
  };
  const blur = (k: keyof FormState) => () => setTouched((t) => ({ ...t, [k]: true }));
  const showErr = (k: keyof FormState) => (touched[k] || submitted) ? errors[k] : undefined;

  const apply = useMutation({
    mutationFn: () => {
      const payload: CreateLeadDto = {
        companyName: f.companyName.trim(),
        contactName: f.contactName.trim(),
        email: f.email.trim(),
        mobile: f.mobile.trim(),
        totalBuses: Number(f.totalBuses),
        city: f.city.trim() || undefined,
        details: f.details.trim() || undefined,
        kyc: {
          legalName: f.legalName.trim() || undefined,
          gstin: f.gstin.trim(),
          pan: f.pan.trim(),
          address: { line1: f.addrLine1, city: f.addrCity, state: f.addrState, pincode: f.addrPincode },
          bankDetails: { bankName: f.bankName, accountNumber: f.accountNumber, ifsc: f.ifsc },
          documents: { gstCertificate: f.docGst, panCard: f.docPan, cancelledCheque: f.docCheque },
        },
      };
      return onboardingApi.apply(payload);
    },
    onSuccess: () => setDone(true),
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : 'Could not submit your application.';
      if (/gstin/i.test(msg)) setServerErrors((s) => ({ ...s, gstin: msg }));
      else if (/pan/i.test(msg)) setServerErrors((s) => ({ ...s, pan: msg }));
      else if (/email/i.test(msg)) setServerErrors((s) => ({ ...s, email: msg }));
      else if (/mobile/i.test(msg)) setServerErrors((s) => ({ ...s, mobile: msg }));
      toast.error(msg);
    },
  });

  const onSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    if (apply.isPending) return;                 // guard: never fire twice
    if (Object.keys(validate(f)).length > 0) return;
    apply.mutate();
  };

  if (done) {
    return (
      <AuthLayout title="Application received" subtitle="Thank you for applying to become a Yoo Bus operator.">
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <p className="text-step-0 text-ink">
            We&rsquo;ve received your application and emailed you a confirmation. Our team reviews new
            operators within about 24 hours, and you&rsquo;ll get an email at every step — including your
            login credentials once you&rsquo;re approved.
          </p>
          <Link to="/sign-in" className="inline-block font-medium text-primary hover:underline">Back to sign in</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Become an Operator"
      subtitle="Tell us about your bus company. One form, no login required."
      footer={
        <p className="text-step-0 text-ink-muted">
          Already have an account?{' '}
          <Link to="/sign-in" className="font-medium text-primary hover:underline">Sign in</Link>
        </p>
      }
    >
      <form className="space-y-6" noValidate onSubmit={onSubmit}>
        <Section icon={<Building2 className="h-4 w-4" />} title="Company">
          <Field label="Company / brand name *" value={f.companyName} onChange={set('companyName')} onBlur={blur('companyName')} error={showErr('companyName')} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total buses *" type="number" value={f.totalBuses} onChange={set('totalBuses')} onBlur={blur('totalBuses')} error={showErr('totalBuses')} />
            <Field label="Operating city" value={f.city} onChange={set('city')} onBlur={blur('city')} error={showErr('city')} />
          </div>
          <TextArea label="Anything you'd like to add" value={f.details} onChange={set('details')} />
        </Section>

        <Section title="Contact person">
          <Field label="Full name *" value={f.contactName} onChange={set('contactName')} onBlur={blur('contactName')} error={showErr('contactName')} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email *" type="email" value={f.email} onChange={set('email')} onBlur={blur('email')} error={showErr('email')} />
            <Field label="Mobile (10 digits) *" value={f.mobile} onChange={set('mobile')} onBlur={blur('mobile')} error={showErr('mobile')} />
          </div>
        </Section>

        <Section title="Business & KYC">
          <Field label="Registered legal name" value={f.legalName} onChange={set('legalName')} onBlur={blur('legalName')} error={showErr('legalName')} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="GSTIN *" value={f.gstin} onChange={set('gstin')} onBlur={blur('gstin')} error={showErr('gstin')} placeholder="07ABCDE1234F1Z5" hint="Each GSTIN can register only one operator." />
            <Field label="PAN *" value={f.pan} onChange={set('pan')} onBlur={blur('pan')} error={showErr('pan')} placeholder="ABCDE1234F" hint="Each PAN can register only one operator." />
          </div>
          <Field label="Address line" value={f.addrLine1} onChange={set('addrLine1')} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="City" value={f.addrCity} onChange={set('addrCity')} />
            <Field label="State" value={f.addrState} onChange={set('addrState')} />
            <Field label="Pincode" value={f.addrPincode} onChange={set('addrPincode')} onBlur={blur('addrPincode')} error={showErr('addrPincode')} />
          </div>
        </Section>

        <Section title="Bank account">
          <Field label="Bank name" value={f.bankName} onChange={set('bankName')} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Account number" value={f.accountNumber} onChange={set('accountNumber')} />
            <Field label="IFSC" value={f.ifsc} onChange={set('ifsc')} onBlur={blur('ifsc')} error={showErr('ifsc')} placeholder="HDFC0001234" />
          </div>
        </Section>

        <Section title="Documents">
          <p className="-mt-1 text-step--1 text-ink-muted">Paste a shareable link to each document (Google Drive, Dropbox, etc.).</p>
          <Field label="GST certificate link" value={f.docGst} onChange={set('docGst')} onBlur={blur('docGst')} error={showErr('docGst')} placeholder="https://…" />
          <Field label="PAN card link" value={f.docPan} onChange={set('docPan')} onBlur={blur('docPan')} error={showErr('docPan')} placeholder="https://…" />
          <Field label="Cancelled cheque link" value={f.docCheque} onChange={set('docCheque')} onBlur={blur('docCheque')} error={showErr('docCheque')} placeholder="https://…" />
        </Section>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          leftIcon={<Send className="h-4 w-4" />}
          isLoading={apply.isPending}
          disabled={apply.isPending || (submitted && hasErrors)}
        >
          {apply.isPending ? 'Submitting…' : 'Submit application'}
        </Button>
        {submitted && hasErrors && (
          <p className="text-center text-step--1 text-red-500">Please fix the highlighted fields above.</p>
        )}
      </form>
    </AuthLayout>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-step-0 font-semibold text-ink">{icon} {title}</h3>
      {children}
    </div>
  );
}

interface FieldProps {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void; type?: string; placeholder?: string; error?: string; hint?: string;
}
function Field({ label, value, onChange, onBlur, type = 'text', placeholder, error, hint }: FieldProps) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        className={`${base} ${error ? bad : ok}`}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={!!error}
      />
      {error ? <p className="mt-1 text-step--1 text-red-500">{error}</p>
        : hint ? <p className="mt-1 text-step--1 text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea className={`${base} ${ok}`} rows={2} value={value} onChange={onChange} />
    </div>
  );
}
