import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { CustomTripPreferenceSections } from '@/components/CustomTripPreferenceFields';
import {
  fetchCustomTripFormConfig,
  preferenceFieldsForRoutePrivate,
  validatePreferenceAnswers,
  type CustomPreferences,
  type CustomTripFormField,
} from '@/lib/customTripFormClient';
import { fieldErrorId, focusFirstFieldError, isValidEmail, type FieldErrors } from '@/lib/formErrors';
import { submitInquiry } from '@/lib/inquiryClient';
import { brand } from '@/lib/siteData';
import { cn } from '@/lib/utils';

export type RouteInquiryTour = {
  slug: string;
  title: string;
  duration: string;
};

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const TRAVELER_OPTIONS = ['1 traveler', '2 travelers', '3-4 travelers', '5-8 travelers', '9+ travelers'];

const ROOM_PREFERENCE_OPTIONS = [
  'No preference',
  'Twin room (two single beds)',
  'Double room (one bed)',
  'Single room (extra cost may apply)',
  'Family / triple room',
];

function yearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear + 1, currentYear + 2].map(String);
}

function ModalField({
  label,
  error,
  fieldKey,
  children,
}: {
  label: string;
  error?: string;
  fieldKey?: string;
  children: ReactNode;
}) {
  return (
    <label className="block" data-field-error={error ? fieldKey : undefined}>
      <span className={cn('mb-2 block text-[15px] font-bold text-[#122332]', error && 'text-red-700')}>
        {label}
      </span>
      {children}
      {error && (
        <span id={fieldKey ? fieldErrorId(fieldKey) : undefined} className="mt-2 block text-[13px] text-red-600" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

const fieldInputClass = (invalid?: boolean) =>
  cn(
    'min-h-[48px] w-full rounded-[6px] border border-[#dce5ee] bg-[#f8fafc] px-4 text-[15px] text-[#122332] outline-none placeholder:text-[#a8b0b8] focus:border-[#294f5b]',
    invalid && 'border-red-500 focus:border-red-500',
  );

function useTurnstileState() {
  const [token, setToken] = useState('');
  const [resetSignal, setResetSignal] = useState(0);
  return {
    token,
    setToken,
    resetSignal,
    reset: () => {
      setToken('');
      setResetSignal((value) => value + 1);
    },
  };
}

function ModalContactFields({
  name,
  email,
  phone,
  fieldErrors,
  onNameChange,
  onEmailChange,
  onPhoneChange,
}: {
  name: string;
  email: string;
  phone: string;
  fieldErrors: FieldErrors;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <ModalField label="Full Name *" error={fieldErrors.name} fieldKey="name">
        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Enter your name"
          aria-invalid={Boolean(fieldErrors.name)}
          className={fieldInputClass(Boolean(fieldErrors.name))}
        />
      </ModalField>
      <ModalField label="Email *" error={fieldErrors.email} fieldKey="email">
        <input
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="you@example.com"
          aria-invalid={Boolean(fieldErrors.email)}
          className={fieldInputClass(Boolean(fieldErrors.email))}
        />
      </ModalField>
      <ModalField label="WhatsApp or Phone (optional)">
        <input
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          placeholder="e.g. +1 555 123 4567"
          className={fieldInputClass()}
        />
      </ModalField>
    </div>
  );
}

/**
 * "Get a Private Quote" — mirrors the mobile app's route-scoped private trip
 * request (route_private inquiry), rendered as a desktop modal.
 */
export function PrivateQuoteModal({
  open,
  onOpenChange,
  tour,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: RouteInquiryTour;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [travelMonth, setTravelMonth] = useState('');
  const [travelYear, setTravelYear] = useState('');
  const [travelers, setTravelers] = useState('');
  const [message, setMessage] = useState('');
  const [preferenceFields, setPreferenceFields] = useState<CustomTripFormField[]>([]);
  const [preferences, setPreferences] = useState<CustomPreferences>({});
  const [preferenceDefaults, setPreferenceDefaults] = useState<CustomPreferences>({});
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const turnstile = useTurnstileState();

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setPhone('');
    setTravelMonth('');
    setTravelYear('');
    setTravelers('');
    setMessage('');
    setFieldErrors({});
    setFormError('');
    setStatus('idle');
    setStatusMessage('');
    turnstile.reset();
    setConfigLoading(true);
    setConfigError('');

    let cancelled = false;
    fetchCustomTripFormConfig()
      .then(({ fields, defaults }) => {
        if (cancelled) return;
        setPreferenceFields(fields);
        setPreferences(defaults);
        setPreferenceDefaults(defaults);
      })
      .catch((error) => {
        if (cancelled) return;
        setConfigError(error instanceof Error ? error.message : 'We could not load the trip preference form.');
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tour.slug]);

  const basicFields = preferenceFieldsForRoutePrivate(preferenceFields);

  const handlePreferenceChange = (fieldKey: string, value: unknown) => {
    setPreferences((current) => ({ ...current, [fieldKey]: value }));
    setFieldErrors((current) => {
      if (!current[fieldKey]) return current;
      const next = { ...current };
      delete next[fieldKey];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (configLoading || configError) return;

    const formElement = event.currentTarget;
    const nextErrors: FieldErrors = {};

    if (!travelMonth || !travelYear) {
      nextErrors.timing = 'Please choose your estimated travel month and year.';
    }
    if (!travelers) {
      nextErrors.timing = nextErrors.timing || 'Please choose your number of travelers.';
    }
    Object.assign(nextErrors, validatePreferenceAnswers(basicFields, preferences));
    if (!name.trim()) nextErrors.name = 'Please enter your full name.';
    if (!email.trim()) nextErrors.email = 'Please enter your email.';
    else if (!isValidEmail(email)) nextErrors.email = 'Please enter a valid email address.';
    if (!turnstile.token) nextErrors.turnstile = 'Please complete the anti-spam check.';

    setFieldErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) {
      setStatus('idle');
      requestAnimationFrame(() => {
        focusFirstFieldError(
          ['timing', ...basicFields.map((field) => field.fieldKey), 'name', 'email', 'turnstile'],
          nextErrors,
          formElement,
        );
      });
      return;
    }

    setStatus('loading');
    try {
      await submitInquiry({
        type: 'route_private',
        requestedTour: tour.title,
        travelMonth: `${travelMonth} ${travelYear}`,
        travelers,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: message.trim(),
        customPreferences: preferences,
        sourcePath: window.location.href,
        turnstileToken: turnstile.token,
      });
      setStatus('success');
      setStatusMessage('Thank you. We received your request and will reply within 24 hours with a personalized quote.');
      setPreferences(preferenceDefaults);
      turnstile.reset();
    } catch (error) {
      setStatus('error');
      setFormError(error instanceof Error ? error.message : 'We could not submit your request. Please try again.');
    }
  };

  const submitting = status === 'loading';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[10px] sm:max-w-[560px]">
        <DialogHeader>
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#88929c]">
            You are inquiring about:
          </p>
          <DialogTitle className="font-serif text-[24px] font-medium leading-tight text-[#122332]">
            {tour.title}
          </DialogTitle>
          <p className="mt-1 text-center text-[20px] font-semibold text-[#2a9f8b] sm:text-left">
            Get Your Personalized Quote
          </p>
          <DialogDescription>
            Share your travel plans and preferences, and we&apos;ll prepare a tailored quote for your
            trip. We&apos;ll get back to you within 24 hours with the next steps.
          </DialogDescription>
          <p className="text-[12px] text-[#a8b0b8]">
            Your details are used only to prepare your itinerary and will never be shared.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <input type="text" name="companyWebsite" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

          <div
            data-field-error="timing"
            className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', fieldErrors.timing && 'rounded-[6px] border border-red-400 bg-red-50/40 p-4')}
          >
            <ModalField label="Estimated Travel Month">
              <select
                value={travelMonth}
                onChange={(event) => setTravelMonth(event.target.value)}
                className={fieldInputClass(Boolean(fieldErrors.timing))}
              >
                <option value="">--- Select a month ---</option>
                {MONTH_OPTIONS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </ModalField>
            <ModalField label="Estimated Travel Year">
              <select
                value={travelYear}
                onChange={(event) => setTravelYear(event.target.value)}
                className={fieldInputClass(Boolean(fieldErrors.timing))}
              >
                <option value="">--- Select a year ---</option>
                {yearOptions().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </ModalField>
            <div className="sm:col-span-2">
              <ModalField label="Number of Travelers">
                <select
                  value={travelers}
                  onChange={(event) => setTravelers(event.target.value)}
                  className={fieldInputClass(Boolean(fieldErrors.timing))}
                >
                  <option value="">--- Select number of travelers ---</option>
                  {TRAVELER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </ModalField>
            </div>
            {fieldErrors.timing && (
              <p id={fieldErrorId('timing')} className="sm:col-span-2 text-[13px] text-red-600" role="alert">
                {fieldErrors.timing}
              </p>
            )}
          </div>

          {configLoading && (
            <p className="rounded-[6px] border border-[#e2e7ec] bg-[#f8fafc] px-4 py-3 text-[14px] text-[#63707a]">
              Loading trip preferences…
            </p>
          )}
          {configError && (
            <p className="rounded-[6px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700" role="alert">
              {configError}
            </p>
          )}
          {!configLoading && !configError && basicFields.length > 0 && (
            <CustomTripPreferenceSections
              basicFields={basicFields}
              moreFields={[]}
              values={preferences}
              errors={fieldErrors}
              moreOpen={false}
              onMoreOpenChange={() => {}}
              variant="desktop"
              onChange={handlePreferenceChange}
            />
          )}

          <ModalField label="Any special interests or requests? (Optional)">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              placeholder="E.g., children's ages, senior-friendly arrangements, vegetarian meals, wheelchair access, special interests like history or food, or other custom requests"
              className={cn(fieldInputClass(), 'min-h-[100px] resize-none py-3')}
            />
          </ModalField>

          <ModalContactFields
            name={name}
            email={email}
            phone={phone}
            fieldErrors={fieldErrors}
            onNameChange={setName}
            onEmailChange={setEmail}
            onPhoneChange={setPhone}
          />

          <div data-field-error="turnstile" className={cn(fieldErrors.turnstile && 'rounded-[6px] border border-red-400 bg-red-50/40 p-3')}>
            <TurnstileWidget onTokenChange={turnstile.setToken} resetSignal={turnstile.resetSignal} />
            {fieldErrors.turnstile && (
              <p id={fieldErrorId('turnstile')} className="mt-2 text-[13px] text-red-600" role="alert">
                {fieldErrors.turnstile}
              </p>
            )}
          </div>

          {formError && (
            <p className="rounded-[6px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700" role="alert">
              {formError}
            </p>
          )}
          {status === 'success' && statusMessage && (
            <p className="rounded-[6px] border border-[#CDE7E1] bg-[#F0FAF7] px-4 py-3 text-[14px] text-[#1D6F62]">
              {statusMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || configLoading || Boolean(configError)}
            className="min-h-[52px] w-full rounded-[6px] bg-[#00394a] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#012934] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {submitting ? 'Sending request...' : 'Get My Personalized Quote'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Group tour inquiry" — a lightweight, route-scoped ask about small-group
 * departures. This does not check or lock live seat inventory; a planner
 * replies by email with the closest real departure, pricing, and next steps.
 */
export function GroupTourInquiryModal({
  open,
  onOpenChange,
  tour,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: RouteInquiryTour;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [datesFlexible, setDatesFlexible] = useState(false);
  const [travelMonth, setTravelMonth] = useState('');
  const [travelYear, setTravelYear] = useState('');
  const [travelers, setTravelers] = useState('');
  const [roomPreference, setRoomPreference] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const turnstile = useTurnstileState();

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setPhone('');
    setDatesFlexible(false);
    setTravelMonth('');
    setTravelYear('');
    setTravelers('');
    setRoomPreference('');
    setNotes('');
    setFieldErrors({});
    setFormError('');
    setStatus('idle');
    setStatusMessage('');
    turnstile.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tour.slug]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formElement = event.currentTarget;
    const nextErrors: FieldErrors = {};

    if (!datesFlexible && (!travelMonth || !travelYear)) {
      nextErrors.timing = 'Please choose a preferred month and year, or mark your dates as flexible.';
    }
    if (!travelers) {
      nextErrors.timing = nextErrors.timing || 'Please choose your number of travelers.';
    }
    if (!name.trim()) nextErrors.name = 'Please enter your full name.';
    if (!email.trim()) nextErrors.email = 'Please enter your email.';
    else if (!isValidEmail(email)) nextErrors.email = 'Please enter a valid email address.';
    if (!turnstile.token) nextErrors.turnstile = 'Please complete the anti-spam check.';

    setFieldErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) {
      setStatus('idle');
      requestAnimationFrame(() => {
        focusFirstFieldError(['timing', 'name', 'email', 'turnstile'], nextErrors, formElement);
      });
      return;
    }

    setStatus('loading');
    const messageParts = [
      roomPreference && roomPreference !== 'No preference' ? `Room preference: ${roomPreference}` : '',
      notes.trim(),
    ].filter(Boolean);

    try {
      await submitInquiry({
        type: 'group_tour_inquiry',
        requestedTour: tour.title,
        travelMonth: datesFlexible
          ? 'Flexible — match to the closest available departure'
          : `${travelMonth} ${travelYear}`,
        travelers,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: messageParts.join('\n\n'),
        sourcePath: window.location.href,
        turnstileToken: turnstile.token,
      });
      setStatus('success');
      setStatusMessage(
        'Thank you. We received your inquiry and will reply within 24 hours with available departure dates and pricing.',
      );
      turnstile.reset();
    } catch (error) {
      setStatus('error');
      setFormError(error instanceof Error ? error.message : 'We could not submit your inquiry. Please try again.');
    }
  };

  const submitting = status === 'loading';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[10px] sm:max-w-[560px]">
        <DialogHeader>
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#88929c]">
            Small Group Tour Inquiry:
          </p>
          <DialogTitle className="font-serif text-[24px] font-medium leading-tight text-[#122332]">
            {tour.title}
          </DialogTitle>
          <DialogDescription>
            Tell us your preferred travel timing, and we&apos;ll reply by email with the closest available
            small-group departure, pricing, and next steps for booking. This does not reserve a seat.
          </DialogDescription>
          <p className="text-[13px] text-[#63707a]">
            Prefer to contact us directly? Email{' '}
            <a href={`mailto:${brand.email}`} className="font-semibold text-[#168dad]">
              {brand.email}
            </a>{' '}
            or WhatsApp{' '}
            <a href={brand.whatsappHref} className="font-semibold text-[#168dad]" target="_blank" rel="noreferrer">
              {brand.phone}
            </a>
            .
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <input type="text" name="companyWebsite" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

          <div
            data-field-error="timing"
            className={cn('space-y-4', fieldErrors.timing && 'rounded-[6px] border border-red-400 bg-red-50/40 p-4')}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ModalField label="Preferred Month">
                <select
                  value={travelMonth}
                  onChange={(event) => setTravelMonth(event.target.value)}
                  disabled={datesFlexible}
                  className={fieldInputClass(Boolean(fieldErrors.timing))}
                >
                  <option value="">--- Select a month ---</option>
                  {MONTH_OPTIONS.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </ModalField>
              <ModalField label="Preferred Year">
                <select
                  value={travelYear}
                  onChange={(event) => setTravelYear(event.target.value)}
                  disabled={datesFlexible}
                  className={fieldInputClass(Boolean(fieldErrors.timing))}
                >
                  <option value="">--- Select a year ---</option>
                  {yearOptions().map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </ModalField>
            </div>
            <label className="flex items-center gap-3 text-[14px] font-semibold text-[#394a5a]">
              <input
                type="checkbox"
                checked={datesFlexible}
                onChange={(event) => setDatesFlexible(event.target.checked)}
                className="h-[16px] w-[16px] accent-[#294f5b]"
              />
              My dates are flexible — match me to the closest available departure
            </label>
            <ModalField label="Number of Travelers">
              <select
                value={travelers}
                onChange={(event) => setTravelers(event.target.value)}
                className={fieldInputClass(Boolean(fieldErrors.timing))}
              >
                <option value="">--- Select number of travelers ---</option>
                {TRAVELER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </ModalField>
            {fieldErrors.timing && (
              <p id={fieldErrorId('timing')} className="text-[13px] text-red-600" role="alert">
                {fieldErrors.timing}
              </p>
            )}
          </div>

          <ModalField label="Room Preference (Optional)">
            <select
              value={roomPreference}
              onChange={(event) => setRoomPreference(event.target.value)}
              className={fieldInputClass()}
            >
              <option value="">--- Select a room preference ---</option>
              {ROOM_PREFERENCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </ModalField>

          <ModalField label="Additional Notes (Optional)">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Any questions about group dates, room type, pricing, or booking"
              className={cn(fieldInputClass(), 'min-h-[100px] resize-none py-3')}
            />
          </ModalField>

          <ModalContactFields
            name={name}
            email={email}
            phone={phone}
            fieldErrors={fieldErrors}
            onNameChange={setName}
            onEmailChange={setEmail}
            onPhoneChange={setPhone}
          />

          <div data-field-error="turnstile" className={cn(fieldErrors.turnstile && 'rounded-[6px] border border-red-400 bg-red-50/40 p-3')}>
            <TurnstileWidget onTokenChange={turnstile.setToken} resetSignal={turnstile.resetSignal} />
            {fieldErrors.turnstile && (
              <p id={fieldErrorId('turnstile')} className="mt-2 text-[13px] text-red-600" role="alert">
                {fieldErrors.turnstile}
              </p>
            )}
          </div>

          {formError && (
            <p className="rounded-[6px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700" role="alert">
              {formError}
            </p>
          )}
          {status === 'success' && statusMessage && (
            <p className="rounded-[6px] border border-[#CDE7E1] bg-[#F0FAF7] px-4 py-3 text-[14px] text-[#1D6F62]">
              {statusMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[52px] w-full rounded-[6px] bg-[#ef4f43] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#d84338] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {submitting ? 'Sending inquiry...' : 'Send Group Tour Inquiry'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
