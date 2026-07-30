import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
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
import {
  clearCheckoutCancelDraft,
  createFixedDepartureCheckoutSession,
  saveCheckoutCancelDraft,
} from '@/lib/checkoutClient';
import {
  checkoutOpenFailedCopy,
  hostedCheckoutTrustCopy,
  openingCheckoutCopy,
  payFullAmountReviewCopy,
} from '@/lib/paymentProviderCopy';
import {
  departureAvailability,
  fetchPublicDepartures,
  formatDeparturePrice,
  type PublicDeparture,
} from '@/lib/departuresClient';
import { fieldErrorId, focusFirstFieldError, isValidEmail, type FieldErrors } from '@/lib/formErrors';
import { submitInquiry } from '@/lib/inquiryClient';
import { formatOrderDateRange } from '@/lib/orderClient';
import {
  buildInternationalPhone,
  DEFAULT_PHONE_COUNTRY_CODE,
  getPhoneCountry,
  PHONE_COUNTRIES,
  validateOptionalPhoneInput,
} from '@/lib/phoneCountries';
import { readStoredAuthSession } from '@/lib/authClient';
import { brand } from '@/lib/siteData';
import {
  resizeTravelers,
  validateTravelerDetails,
  type TravelerNameDraft,
} from '@/lib/travelerNames';
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

type GroupInquiryStep = 'form' | 'confirm';

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
          aria-describedby={fieldErrors.name ? fieldErrorId('name') : undefined}
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
          aria-describedby={fieldErrors.email ? fieldErrorId('email') : undefined}
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
            aria-invalid={Boolean(fieldErrors.timing)}
            aria-describedby={fieldErrors.timing ? fieldErrorId('timing') : undefined}
            className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', fieldErrors.timing && 'rounded-[6px] border border-red-400 bg-red-50/40 p-4')}
          >
            <ModalField label="Estimated Travel Month">
              <select
                value={travelMonth}
                onChange={(event) => setTravelMonth(event.target.value)}
                aria-invalid={Boolean(fieldErrors.timing)}
                aria-describedby={fieldErrors.timing ? fieldErrorId('timing') : undefined}
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
                aria-invalid={Boolean(fieldErrors.timing)}
                aria-describedby={fieldErrors.timing ? fieldErrorId('timing') : undefined}
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
                  aria-invalid={Boolean(fieldErrors.timing)}
                  aria-describedby={fieldErrors.timing ? fieldErrorId('timing') : undefined}
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

          <div
            data-field-error="turnstile"
            data-error-scroll-only
            aria-invalid={Boolean(fieldErrors.turnstile)}
            aria-describedby={fieldErrors.turnstile ? fieldErrorId('turnstile') : undefined}
            className={cn(fieldErrors.turnstile && 'rounded-[6px] border border-red-400 bg-red-50/40 p-3')}
          >
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
 * Social tour booking — departure-bound like the Mini-App:
 * pick a sellable departure → traveler roster → confirm → hosted checkout.
 */
export function GroupTourInquiryModal({
  open,
  onOpenChange,
  tour,
  initialDepartureId = '',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: RouteInquiryTour;
  initialDepartureId?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <GroupTourInquiryBody
          key={`${tour.slug}::${initialDepartureId}`}
          tour={tour}
          initialDepartureId={initialDepartureId}
        />
      ) : null}
    </Dialog>
  );
}

function GroupTourInquiryBody({
  tour,
  initialDepartureId,
}: {
  tour: RouteInquiryTour;
  initialDepartureId: string;
}) {
  const [step, setStep] = useState<GroupInquiryStep>('form');
  const [departures, setDepartures] = useState<PublicDeparture[]>([]);
  const [departuresLoading, setDeparturesLoading] = useState(true);
  const [departuresError, setDeparturesError] = useState('');
  const [departureId, setDepartureId] = useState(initialDepartureId);
  const [adultQuantity, setAdultQuantity] = useState(1);
  const [travelers, setTravelers] = useState<TravelerNameDraft[]>(() =>
    resizeTravelers([], 1),
  );
  const [email, setEmail] = useState('');
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_PHONE_COUNTRY_CODE);
  const [phoneNational, setPhoneNational] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');

  const bookableDepartures = useMemo(
    () => departures.filter((departure) => departureAvailability(departure).bookable),
    [departures],
  );
  const selectedDeparture = bookableDepartures.find((departure) => departure.publicId === departureId);

  useEffect(() => {
    const controller = new AbortController();

    fetchPublicDepartures(controller.signal)
      .then((records) => {
        const forRoute = records.filter((departure) => departure.routeSlug === tour.slug);
        setDepartures(forRoute);
        const bookable = forRoute.filter((departure) => departureAvailability(departure).bookable);
        const preferred =
          bookable.find((departure) => departure.publicId === initialDepartureId) || bookable[0];
        if (preferred) {
          setDepartureId(preferred.publicId);
          const maxAdults = Math.min(8, Math.max(1, preferred.availableSeats));
          setAdultQuantity(1);
          setTravelers(resizeTravelers([], Math.min(1, maxAdults)));
        } else {
          setDepartureId('');
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDeparturesError(
          error instanceof Error ? error.message : 'We could not load departures.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setDeparturesLoading(false);
      });

    return () => controller.abort();
  }, [tour.slug, initialDepartureId]);

  const phone = buildInternationalPhone(phoneCountry, phoneNational);

  const selectDeparture = (departure: PublicDeparture) => {
    const maxAdults = Math.min(8, Math.max(1, departure.availableSeats));
    const nextQty = Math.min(Math.max(1, adultQuantity), maxAdults);
    setDepartureId(departure.publicId);
    setAdultQuantity(nextQty);
    setTravelers((current) => resizeTravelers(current, nextQty));
    setFieldErrors((current) => {
      if (!current.departure) return current;
      const next = { ...current };
      delete next.departure;
      return next;
    });
  };

  const validateForm = (formElement?: HTMLFormElement | null) => {
    const nextErrors: FieldErrors = {};
    const travelerError = validateTravelerDetails(travelers, adultQuantity);
    const phoneError = validateOptionalPhoneInput(phoneCountry, phoneNational);

    if (!selectedDeparture) nextErrors.departure = 'Choose an available departure date.';
    if (travelerError) {
      const key =
        travelerError.field === 'gender'
          ? `traveler-${travelerError.index}-gender`
          : `traveler-${travelerError.index}`;
      nextErrors[key] = travelerError.message;
    }
    if (!email.trim()) nextErrors.email = 'Please enter your email.';
    else if (!isValidEmail(email)) nextErrors.email = 'Please enter a valid email address.';
    if (phoneError) nextErrors.phone = phoneError;

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const fieldOrder = [
        'departure',
        ...travelers.flatMap((_, index) => [`traveler-${index}`, `traveler-${index}-gender`]),
        'email',
        'phone',
      ];
      requestAnimationFrame(() => {
        focusFirstFieldError(fieldOrder, nextErrors, formElement ?? undefined);
      });
      return false;
    }
    return true;
  };

  const handleContinue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setStatus('idle');
    if (!validateForm(event.currentTarget)) return;
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!validateForm()) {
      setStep('form');
      return;
    }
    if (!selectedDeparture) return;

    setStatus('loading');
    setFormError('');
    setFieldErrors({});

    const roster = travelers.map((traveler) => ({
      name: traveler.name.trim(),
      gender: traveler.gender as 'male' | 'female',
    }));
    const leadName = roster[0]?.name || '';
    const checkoutEmail = email.trim().toLowerCase();
    const dateLabel = formatOrderDateRange(selectedDeparture.startDate, selectedDeparture.endDate);
    const authSession = readStoredAuthSession();

    try {
      saveCheckoutCancelDraft({
        destinationSlug: selectedDeparture.destinationSlug || '',
        routeSlug: tour.slug,
        departureId: selectedDeparture.publicId,
        dateRange: dateLabel,
        adultQuantity,
        travelers: roster,
        name: leadName,
        email: checkoutEmail,
        phoneCountry,
        phoneNational,
        phone,
        notes: notes.trim(),
      });

      const result = await createFixedDepartureCheckoutSession({
        departureId: selectedDeparture.publicId,
        adultQuantity,
        name: leadName,
        email: checkoutEmail,
        travelers: roster,
        phone: phone || undefined,
        notes: notes.trim() || undefined,
        accessToken: authSession?.accessToken,
      });

      window.location.assign(result.checkoutUrl!);
    } catch (error) {
      clearCheckoutCancelDraft();
      setStatus('error');
      setFormError(
        error instanceof Error ? error.message : checkoutOpenFailedCopy(),
      );
    }
  };

  const submitting = status === 'loading';
  const maxAdults = selectedDeparture
    ? Math.min(8, Math.max(1, selectedDeparture.availableSeats))
    : 1;
  const currency = (selectedDeparture?.currency || 'usd').toUpperCase();
  const unitPriceDollars = selectedDeparture
    ? (selectedDeparture.adultPriceCents / 100).toFixed(2)
    : '0.00';
  const totalPriceDollars = selectedDeparture
    ? ((selectedDeparture.adultPriceCents * adultQuantity) / 100).toFixed(2)
    : '0.00';
  const dateLabel = selectedDeparture
    ? formatOrderDateRange(selectedDeparture.startDate, selectedDeparture.endDate)
    : '';

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[10px] sm:max-w-[600px]">
        <DialogHeader>
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#88929c]">
            Social tour booking
          </p>
          <DialogTitle className="font-serif text-[24px] font-medium leading-tight text-[#122332]">
            {tour.title}
          </DialogTitle>
          <DialogDescription>
            {step === 'confirm'
              ? payFullAmountReviewCopy()
              : 'Choose a published departure, add traveler details, then pay to confirm your booking.'}
          </DialogDescription>
          <p className="text-[13px] text-[#63707a]">
            Prefer to contact us directly? Email{' '}
            <a href={`mailto:${brand.email}`} className="font-semibold text-[#168dad]">
              {brand.email}
            </a>{' '}
            or WhatsApp{' '}
            <a
              href={brand.whatsappHref}
              className="font-semibold text-[#168dad]"
              target="_blank"
              rel="noreferrer"
            >
              {brand.phone}
            </a>
            .
          </p>
        </DialogHeader>

        {step === 'form' ? (
          <form onSubmit={handleContinue} noValidate className="space-y-6">
            <input
              type="text"
              name="companyWebsite"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            <div
              data-field-error="departure"
              data-error-scroll-only
              aria-invalid={Boolean(fieldErrors.departure)}
              aria-describedby={fieldErrors.departure ? fieldErrorId('departure') : undefined}
              className={cn(
                'space-y-3',
                fieldErrors.departure && 'rounded-[6px] border border-red-400 bg-red-50/40 p-4',
              )}
            >
              <h3 className="text-[15px] font-bold text-[#122332]">Choose a departure</h3>
              {departuresLoading ? (
                <p className="text-[14px] text-[#63707a]">Loading departures…</p>
              ) : null}
              {departuresError ? (
                <p className="text-[14px] text-red-600" role="alert">
                  {departuresError}
                </p>
              ) : null}
              {!departuresLoading && !departuresError && bookableDepartures.length === 0 ? (
                <p className="rounded-[6px] border border-[#e2e7ec] bg-[#f8fafc] px-4 py-3 text-[14px] text-[#63707a]">
                  No social tour departures are available for this route yet. Use Get a Private Quote
                  on the route page, or tell us your dates via Custom Trip.
                </p>
              ) : null}
              <div className="space-y-2">
                {bookableDepartures.map((departure) => {
                  const availability = departureAvailability(departure);
                  const selected = departure.publicId === departureId;
                  return (
                    <button
                      key={departure.publicId}
                      type="button"
                      onClick={() => selectDeparture(departure)}
                      className={cn(
                        'w-full rounded-[8px] border px-4 py-3 text-left transition-colors',
                        selected
                          ? 'border-[#287F73] bg-[#EFFAF6]'
                          : 'border-[#dce5ee] bg-[#f8fafc] hover:border-[#B7CBC7]',
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[15px] font-semibold text-[#122332]">
                            {formatOrderDateRange(departure.startDate, departure.endDate)}
                          </p>
                          <p className="mt-1 text-[13px] text-[#63707a]">
                            Departs {departure.departureCity} · {formatDeparturePrice(departure)} / adult
                          </p>
                        </div>
                        <span className="rounded-full bg-[#EDF6FF] px-2.5 py-1 text-[12px] font-semibold text-[#245D83]">
                          {availability.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.departure ? (
                <p id={fieldErrorId('departure')} className="text-[13px] text-red-600" role="alert">
                  {fieldErrors.departure}
                </p>
              ) : null}
            </div>

            <div className="space-y-4">
              <h3 className="text-[15px] font-bold text-[#122332]">Travelers</h3>
              <ModalField label="Adults">
                <select
                  value={adultQuantity}
                  disabled={!selectedDeparture}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setAdultQuantity(next);
                    setTravelers((current) => resizeTravelers(current, next));
                  }}
                  className={fieldInputClass()}
                >
                  {Array.from({ length: maxAdults }, (_, index) => index + 1).map((count) => (
                    <option key={count} value={count}>
                      {count} adult{count > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </ModalField>

              {travelers.map((traveler, index) => {
                const nameKey = `traveler-${index}`;
                const genderKey = `traveler-${index}-gender`;
                return (
                  <div key={nameKey} className="space-y-3 rounded-[8px] border border-[#e2e7ec] p-4">
                    <ModalField
                      label={index === 0 ? `Traveler ${index + 1} (lead) *` : `Traveler ${index + 1} *`}
                      error={fieldErrors[nameKey]}
                      fieldKey={nameKey}
                    >
                      <input
                        value={traveler.name}
                        onChange={(event) => {
                          const value = event.target.value;
                          setTravelers((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, name: value } : item,
                            ),
                          );
                          setFieldErrors((current) => {
                            if (!current[nameKey]) return current;
                            const next = { ...current };
                            delete next[nameKey];
                            return next;
                          });
                        }}
                        placeholder={
                          index === 0 ? 'Lead traveler full name' : `Adult ${index + 1} full name`
                        }
                        autoComplete={index === 0 ? 'name' : 'off'}
                        aria-invalid={Boolean(fieldErrors[nameKey])}
                        aria-describedby={
                          fieldErrors[nameKey] ? fieldErrorId(nameKey) : undefined
                        }
                        className={fieldInputClass(Boolean(fieldErrors[nameKey]))}
                      />
                    </ModalField>
                    <fieldset
                      data-field-error={genderKey}
                      aria-invalid={Boolean(fieldErrors[genderKey])}
                      aria-describedby={
                        fieldErrors[genderKey] ? fieldErrorId(genderKey) : undefined
                      }
                      className={cn(
                        fieldErrors[genderKey] && 'rounded-[6px] border border-red-400 bg-red-50/40 p-3',
                      )}
                    >
                      <legend className="mb-2 text-[15px] font-bold text-[#122332]">Gender *</legend>
                      <div className="flex gap-4">
                        {(['female', 'male'] as const).map((gender) => (
                          <label key={gender} className="flex items-center gap-2 text-[14px] font-semibold text-[#394a5a]">
                            <input
                              type="radio"
                              name={`desktop-traveler-${index}-gender`}
                              value={gender}
                              checked={traveler.gender === gender}
                              onChange={() => {
                                setTravelers((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, gender } : item,
                                  ),
                                );
                                setFieldErrors((current) => {
                                  if (!current[genderKey]) return current;
                                  const next = { ...current };
                                  delete next[genderKey];
                                  return next;
                                });
                              }}
                              className="h-[16px] w-[16px] accent-[#294f5b]"
                            />
                            {gender === 'female' ? 'Female' : 'Male'}
                          </label>
                        ))}
                      </div>
                      {fieldErrors[genderKey] ? (
                        <p id={fieldErrorId(genderKey)} className="mt-2 text-[13px] text-red-600" role="alert">
                          {fieldErrors[genderKey]}
                        </p>
                      ) : null}
                    </fieldset>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4">
              <h3 className="text-[15px] font-bold text-[#122332]">Contact</h3>
              <ModalField label="Email *" error={fieldErrors.email} fieldKey="email">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFieldErrors((current) => {
                      if (!current.email) return current;
                      const next = { ...current };
                      delete next.email;
                      return next;
                    });
                  }}
                  autoComplete="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? fieldErrorId('email') : undefined}
                  className={fieldInputClass(Boolean(fieldErrors.email))}
                />
              </ModalField>
              <div
                data-field-error="phone"
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? fieldErrorId('phone') : undefined}
                className={cn(
                  'space-y-2',
                  fieldErrors.phone && 'rounded-[6px] border border-red-400 bg-red-50/40 p-3',
                )}
              >
                <span className="block text-[15px] font-bold text-[#122332]">WhatsApp / phone (optional)</span>
                <div className="grid grid-cols-[140px_1fr] gap-3">
                  <select
                    value={phoneCountry}
                    onChange={(event) => setPhoneCountry(event.target.value)}
                    aria-label="Phone country"
                    className={fieldInputClass(Boolean(fieldErrors.phone))}
                  >
                    {PHONE_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.code} +{country.dial}
                      </option>
                    ))}
                  </select>
                  <input
                    value={phoneNational}
                    onChange={(event) => {
                      setPhoneNational(event.target.value);
                      setFieldErrors((current) => {
                        if (!current.phone) return current;
                        const next = { ...current };
                        delete next.phone;
                        return next;
                      });
                    }}
                    placeholder="Local number"
                    inputMode="tel"
                    autoComplete="tel-national"
                    aria-invalid={Boolean(fieldErrors.phone)}
                    className={fieldInputClass(Boolean(fieldErrors.phone))}
                  />
                </div>
                <p className="text-[12px] text-[#88929c]">
                  {getPhoneCountry(phoneCountry).name}
                  {phone ? ` · ${phone}` : ''}
                </p>
                {fieldErrors.phone ? (
                  <p id={fieldErrorId('phone')} className="text-[13px] text-red-600" role="alert">
                    {fieldErrors.phone}
                  </p>
                ) : null}
              </div>
              <ModalField label="Notes (optional)">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Hotel level, pace, food, accessibility, or guide language"
                  className={cn(fieldInputClass(), 'min-h-[90px] resize-none py-3')}
                />
              </ModalField>
            </div>

            {formError ? (
              <p
                className="rounded-[6px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700"
                role="alert"
              >
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={departuresLoading || bookableDepartures.length === 0}
              className="min-h-[52px] w-full rounded-[6px] bg-[#ef4f43] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#d84338] disabled:cursor-not-allowed disabled:opacity-65"
            >
              Continue to payment
            </button>
          </form>
        ) : null}

        {step === 'confirm' && selectedDeparture ? (
          <div className="space-y-6">
            <div className="rounded-[8px] border border-[#dce5ee] bg-[#f8fafc] p-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#718087]">
                Departure
              </p>
              <p className="mt-1 text-[16px] font-semibold text-[#122332]">{dateLabel}</p>
              <p className="mt-1 text-[13px] text-[#63707a]">
                {selectedDeparture.departureCity} · {departureAvailability(selectedDeparture).label}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-[15px] font-bold text-[#122332]">Travelers</h3>
              <p className="text-[14px] text-[#63707a]">
                {adultQuantity} adult{adultQuantity > 1 ? 's' : ''}
              </p>
              {travelers.map((traveler, index) => (
                <p key={`review-${index}`} className="text-[14px] text-[#122332]">
                  Traveler {index + 1}
                  {index === 0 ? ' (lead)' : ''}: {traveler.name} · {traveler.gender}
                </p>
              ))}
              <p className="text-[14px] text-[#122332]">Email: {email.trim()}</p>
              {phone ? <p className="text-[14px] text-[#122332]">Phone: {phone}</p> : null}
            </div>

            <div className="space-y-2">
              <h3 className="text-[15px] font-bold text-[#122332]">Payment</h3>
              <div className="flex justify-between text-[14px] text-[#122332]">
                <span>Price per adult</span>
                <strong>
                  ${unitPriceDollars} {currency}
                </strong>
              </div>
              <div className="flex justify-between text-[15px] font-semibold text-[#122332]">
                <span>Total due today</span>
                <strong>
                  ${totalPriceDollars} {currency}
                </strong>
              </div>
              <p className="text-[13px] leading-6 text-[#63707a]">
                {hostedCheckoutTrustCopy()}
              </p>
            </div>

            {formError ? (
              <p
                className="rounded-[6px] border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700"
                role="alert"
              >
                {formError}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setFormError('');
                  setFieldErrors({});
                  setStatus('idle');
                }}
                className="min-h-[52px] w-full rounded-[6px] border border-[#B7CBC7] px-6 text-[16px] font-semibold text-[#002A3A]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleConfirm()}
                className="min-h-[52px] w-full rounded-[6px] bg-[#ef4f43] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#d84338] disabled:cursor-not-allowed disabled:opacity-65"
              >
                {submitting ? openingCheckoutCopy() : 'Pay full amount'}
              </button>
            </div>
          </div>
        ) : null}
    </DialogContent>
  );
}
