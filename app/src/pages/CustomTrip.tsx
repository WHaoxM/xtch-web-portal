import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, ShieldCheck } from 'lucide-react';
import { CustomTripPreferenceSections } from '@/components/CustomTripPreferenceFields';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import {
  fetchCustomTripFormConfig,
  preferenceFieldsByGroup,
  validatePreferenceAnswers,
  type CustomPreferences,
  type CustomTripFormField,
} from '@/lib/customTripFormClient';
import {
  fieldErrorId,
  focusFirstFieldError,
  isValidEmail,
  type FieldErrors,
} from '@/lib/formErrors';
import { submitInquiry } from '@/lib/inquiryClient';
import { hostedCheckoutTrustCopy, openingCheckoutCopy } from '@/lib/paymentProviderCopy';
import { cn } from '@/lib/utils';

const PLANNING_PAYMENT_PENDING_NOTE =
  'Online payment for private/custom trips is not configured yet. Confirm the amount/product next, or send a planning request by email below.';

type FormStep = 'form' | 'confirm';
type PayStatus = 'idle' | 'loading' | 'error';
type EmailStatus = 'idle' | 'loading' | 'success' | 'error';

type CustomTripDraft = {
  destinations: string[];
  otherDestination: string;
  travelDate: string;
  travelers: string;
  days: string;
  interests: string[];
  fullName: string;
  email: string;
  phone: string;
  contactPreference: string[];
  message: string;
  preferences: CustomPreferences;
  requestedTour: string;
  requestedDestination: string;
  sourcePath: string;
};

const promiseLines = [
  'A private trip shaped around your pace, interests, and the way you like to travel',
  'Thoughtful planning that connects iconic sights with quieter, more personal moments',
  'Planned and handled by our China-based team, with the details cared for before you arrive and while you travel',
];

const destinations = [
  { name: 'Beijing', image: '/images/dest-beijing.jpg' },
  { name: 'Shanghai', image: '/images/dest-shanghai.jpg' },
  { name: "Xi’an", image: '/images/terracotta-warriors-xian-china.jpg' },
  { name: 'Chengdu', image: '/images/dest-chengdu.jpg' },
  { name: 'Chongqing', image: '/images/dest-chongqing.jpg' },
  { name: 'Zhangjiajie', image: '/images/dest-zhangjiajie.jpg' },
  { name: 'Guilin & Yangshuo', image: '/images/route-guilin.jpg' },
  { name: 'Hangzhou', image: '/images/dest-suzhou.jpg' },
  { name: 'Suzhou', image: '/images/dest-suzhou.jpg' },
  { name: 'Huangshan', image: '/images/zhangjiajie-avatar-hallelujah-mountain-destination-card.jpg' },
  { name: 'Jiuzhaigou', image: '/images/route-jiuzhaigou.jpg' },
  { name: 'Yunnan', image: '/images/route-yunnan-lijiang.jpg' },
  { name: 'Tibet', image: '/images/route-tibet-yamdrok-01.jpg' },
  { name: 'Xinjiang', image: '/images/route-xinjiang-yili.jpg' },
  { name: 'Yangtze River Cruise', image: '/images/ref-banner-misty-river.jpg' },
  { name: 'Other', image: '/images/logo-tocn-reference.png' },
];

const interests = [
  'Culture & history',
  'Nature',
  'Local culture & daily life',
  'Family-friendly',
  'Photography',
  'Food & local cuisine',
  'Train travel',
  'Hiking',
  'Other (please specify)',
];

const contactOptions = [
  'WhatsApp',
  'Email',
  'WhatsApp or email is fine',
  'WeChat (if you use it)',
  'Phone call',
];

export default function CustomTrip() {
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [step, setStep] = useState<FormStep>('form');
  const [draft, setDraft] = useState<CustomTripDraft | null>(null);
  const [payStatus, setPayStatus] = useState<PayStatus>('idle');
  const [payError, setPayError] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
  const [emailError, setEmailError] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const [preferenceFields, setPreferenceFields] = useState<CustomTripFormField[]>([]);
  const [preferences, setPreferences] = useState<CustomPreferences>({});
  const [preferenceDefaults, setPreferenceDefaults] = useState<CustomPreferences>({});
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const location = useLocation();
  const requestedTour = new URLSearchParams(location.search).get('tour') ?? '';
  const requestedDestination = new URLSearchParams(location.search).get('destination') ?? '';

  const basicFields = useMemo(
    () => preferenceFieldsByGroup(preferenceFields, 'basic'),
    [preferenceFields],
  );
  const moreFields = useMemo(
    () => preferenceFieldsByGroup(preferenceFields, 'more'),
    [preferenceFields],
  );
  const fieldOrder = useMemo(
    () => [
      'destinations',
      'timing',
      ...basicFields.map((field) => field.fieldKey),
      ...moreFields.map((field) => field.fieldKey),
      'fullName',
      'email',
    ],
    [basicFields, moreFields],
  );

  useEffect(() => {
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
        setConfigError(
          error instanceof Error ? error.message : 'We could not load the trip preference form.',
        );
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (value: string, list: string[], update: (next: string[]) => void) => {
    update(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const handlePreferenceChange = (fieldKey: string, value: unknown) => {
    setPreferences((current) => ({ ...current, [fieldKey]: value }));
    setFieldErrors((current) => {
      if (!current[fieldKey]) return current;
      const next = { ...current };
      delete next[fieldKey];
      return next;
    });
  };

  const resetAfterEmailSuccess = () => {
    setSelectedDestinations([]);
    setSelectedInterests([]);
    setPreferences(preferenceDefaults);
    setMoreOpen(false);
    setFieldErrors({});
    setFormError('');
    setDraft(null);
    setStep('form');
    setPayStatus('idle');
    setPayError('');
    setEmailStatus('idle');
    setEmailError('');
    setEmailMessage('');
    setTurnstileToken('');
    setTurnstileResetSignal((value) => value + 1);
    setFormKey((value) => value + 1);
  };

  const handleContinue = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (configLoading || configError) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const getValue = (name: string) => String(form.get(name) ?? '').trim();
    const nextErrors: FieldErrors = {};
    const otherDestination = getValue('otherDestination');
    const travelDate = getValue('travelDate');
    const travelers = getValue('travelers');
    const days = getValue('days');
    const fullName = getValue('fullName');
    const email = getValue('email');
    const contactPreference = form.getAll('contactPreference').map(String);
    const hasDestination =
      selectedDestinations.length > 0 || Boolean(otherDestination) || Boolean(requestedDestination);
    const hasTiming = Boolean(travelDate || travelers || days);

    if (!hasDestination) {
      nextErrors.destinations = 'Please choose or specify at least one destination.';
    }
    if (!hasTiming) {
      nextErrors.timing = 'Please share at least one trip timing or group-size detail.';
    }

    Object.assign(nextErrors, validatePreferenceAnswers(preferenceFields, preferences));

    if (!fullName) nextErrors.fullName = 'Please enter your full name.';
    if (!email) nextErrors.email = 'Please enter your email.';
    else if (!isValidEmail(email)) nextErrors.email = 'Please enter a valid email address.';

    setFieldErrors(nextErrors);
    setFormError('');
    setPayError('');
    setPayStatus('idle');
    setEmailError('');
    setEmailMessage('');
    setEmailStatus('idle');
    if (Object.keys(nextErrors).length) {
      const moreError = moreFields.some((field) => nextErrors[field.fieldKey]);
      if (moreError) setMoreOpen(true);
      requestAnimationFrame(() => {
        focusFirstFieldError([...fieldOrder], nextErrors, formElement);
      });
      return;
    }

    setDraft({
      destinations: [...selectedDestinations],
      otherDestination,
      travelDate,
      travelers,
      days,
      interests: [...selectedInterests],
      fullName,
      email,
      phone: getValue('phone'),
      contactPreference,
      message: getValue('message'),
      preferences: { ...preferences },
      requestedTour,
      requestedDestination,
      sourcePath: window.location.href,
    });
    setStep('confirm');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const attemptPayment = () => {
    setPayStatus('error');
    setPayError(PLANNING_PAYMENT_PENDING_NOTE);
  };

  const sendEmailRequest = async () => {
    if (!draft) return;
    if (!turnstileToken) {
      setEmailStatus('error');
      setEmailError('Please complete the anti-spam check.');
      return;
    }

    setEmailStatus('loading');
    setEmailError('');
    setEmailMessage('');
    setPayError('');

    try {
      await submitInquiry({
        type: 'custom_trip',
        requestedTour: draft.requestedTour,
        requestedDestination: draft.requestedDestination,
        destinations: draft.destinations,
        otherDestination: draft.otherDestination,
        travelMonth: draft.travelDate,
        travelers: draft.travelers,
        tripLength: draft.days,
        supportPreference: draft.contactPreference.join(', '),
        interests: draft.interests,
        name: draft.fullName,
        email: draft.email,
        phone: draft.phone,
        message: draft.message,
        customPreferences: draft.preferences,
        sourcePath: draft.sourcePath,
        turnstileToken,
        honeypot: '',
      });
      setEmailStatus('success');
      setEmailMessage('Thank you. We received your inquiry and will reply within 24 hours.');
      setTurnstileToken('');
      setTurnstileResetSignal((value) => value + 1);
    } catch (error) {
      setEmailStatus('error');
      setEmailError(
        error instanceof Error ? error.message : 'We could not submit your inquiry. Please try again.',
      );
      setTurnstileToken('');
      setTurnstileResetSignal((value) => value + 1);
    }
  };

  const paying = payStatus === 'loading';
  const sendingEmail = emailStatus === 'loading';
  const emailDone = emailStatus === 'success';

  const reviewRows = draft
    ? [
        ...(draft.requestedTour
          ? [{ label: 'Route inquiry', value: draft.requestedTour }]
          : []),
        ...(draft.requestedDestination
          ? [{ label: 'Destination inquiry', value: draft.requestedDestination }]
          : []),
        {
          label: 'Destinations',
          value:
            [...draft.destinations, draft.otherDestination].filter(Boolean).join(', ') || '—',
        },
        ...(draft.travelDate ? [{ label: 'Estimated travel date', value: draft.travelDate }] : []),
        ...(draft.travelers ? [{ label: 'Travelers', value: draft.travelers }] : []),
        ...(draft.days ? [{ label: 'Trip length', value: draft.days }] : []),
        ...(draft.interests.length
          ? [{ label: 'Interests', value: draft.interests.join(', ') }]
          : []),
        { label: 'Name', value: draft.fullName },
        { label: 'Email', value: draft.email },
        ...(draft.phone ? [{ label: 'Phone', value: draft.phone }] : []),
        ...(draft.contactPreference.length
          ? [{ label: 'Contact preference', value: draft.contactPreference.join(', ') }]
          : []),
        ...(draft.message ? [{ label: 'Notes', value: draft.message }] : []),
      ]
    : [];

  return (
    <div className="bg-white text-[#122332]">
      <section className="relative min-h-[430px] overflow-hidden bg-[#061417]">
        <img
          src="/images/ref-banner-misty-river.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,18,26,0.86),rgba(0,18,26,0.58)),linear-gradient(180deg,rgba(0,0,0,0.72),rgba(0,0,0,0.38))]" />
        <div className="relative mx-auto flex min-h-[430px] max-w-[1120px] items-center px-6 pt-24 text-white">
          <div className="max-w-[760px]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-white/86 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
              Private China Trip Planning
            </p>
            <h1 className="mt-5 font-serif text-[42px] font-medium leading-[1.12] !text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.72)] md:text-[66px]">
              Plan Your Private China Tour
            </h1>
            <p className="mt-5 max-w-[560px] text-[17px] leading-8 !text-white/92 drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
              Share the basics. We will shape a calm, realistic route around your dates,
              pace, and interests.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:px-10 md:py-24">
        <div className="mx-auto max-w-[1120px]">
          <ul className="mx-auto max-w-[930px] space-y-8 text-[18px] leading-8 text-[#6c747b]">
            {promiseLines.map((line) => (
              <li key={line} className="flex gap-4">
                <Check className="mt-1 shrink-0 text-[#d0a762]" size={18} />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-14 max-w-[930px] overflow-hidden bg-white shadow-[0_1px_18px_rgba(0,0,0,0.04)]">
            <div className="relative bg-[#294f5b] px-8 pb-24 pt-16 text-center text-white md:px-14">
              <h2 className="font-serif text-[31px] font-semibold leading-tight text-[#d2aa63] md:text-[40px]">
                Syncing Travel — Your China Trip Plan
              </h2>
              <p className="mx-auto mt-7 max-w-[760px] text-[17px] font-semibold leading-9 text-white">
                {step === 'confirm'
                  ? 'Review your plan, then continue through the shared payment entry. Until the payable product is set, you can still email this request to a planner.'
                  : 'Tell us your trip basics. Share your dates, group size, places you’d like to visit, and any special preferences. If you’re not sure yet, rough ideas are perfectly fine. We’ll reply within 24 hours with realistic route ideas and next steps.'}
              </p>
              <div
                className="absolute inset-x-0 bottom-[-1px] h-16 bg-white"
                style={{
                  clipPath: 'polygon(0 0, 50% 100%, 100% 0, 100% 100%, 0 100%)',
                }}
              />
            </div>

            <div className={cn('px-6 pb-14 pt-16 md:px-8', step !== 'form' && 'hidden')}>
              <form key={formKey} onSubmit={handleContinue} noValidate>
            <input
              type="text"
              name="companyWebsite"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

              {(requestedTour || requestedDestination) && (
                <div className="mb-10 rounded-[3px] border border-[#e2e7ec] bg-[#f8fafc] px-5 py-4 text-[15px] leading-7 text-[#63707a]">
                  {requestedTour && (
                    <p>
                      Route inquiry: <span className="font-semibold text-[#122332]">{requestedTour}</span>
                    </p>
                  )}
                  {requestedDestination && (
                    <p>
                      Destination inquiry:{' '}
                      <span className="font-semibold text-[#122332]">{requestedDestination}</span>
                    </p>
                  )}
                </div>
              )}

              <fieldset
                data-field-error="destinations"
                aria-invalid={Boolean(fieldErrors.destinations)}
                aria-describedby={fieldErrors.destinations ? fieldErrorId('destinations') : undefined}
                className={cn(
                  'rounded-[6px]',
                  fieldErrors.destinations && 'border border-red-400 bg-red-50/40 p-4 md:p-5',
                )}
              >
                <legend className={cn('text-[18px] font-bold text-[#122332]', fieldErrors.destinations && 'text-red-700')}>
                  Where would you like to go? <span className="text-red-600">*</span>
                </legend>
                <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4 md:gap-x-16">
                  {destinations.map((destination) => (
                    <label
                      key={destination.name}
                      className="flex cursor-pointer flex-col items-center text-center"
                    >
                      <img
                        src={destination.image}
                        alt={destination.name}
                        className="h-[118px] w-[118px] rounded-[13px] object-cover"
                      />
                      <input
                        type="checkbox"
                        checked={selectedDestinations.includes(destination.name)}
                        onChange={() =>
                          toggle(destination.name, selectedDestinations, setSelectedDestinations)
                        }
                        className="mt-6 h-[18px] w-[18px] accent-[#294f5b]"
                      />
                      <span className="mt-4 min-h-[42px] text-[16px] font-bold leading-6 text-[#1f1f1f]">
                        {destination.name}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-8">
                  <TextField
                    name="otherDestination"
                    label="Other destination"
                    placeholder="Optional"
                  />
                </div>
                {fieldErrors.destinations && (
                  <p id={fieldErrorId('destinations')} className="mt-3 text-[14px] text-red-600" role="alert">
                    {fieldErrors.destinations}
                  </p>
                )}
              </fieldset>

              <div className="mt-14 space-y-7">
                <div
                  data-field-error="timing"
                  aria-invalid={Boolean(fieldErrors.timing)}
                  aria-describedby={fieldErrors.timing ? fieldErrorId('timing') : undefined}
                  className={cn(
                    'space-y-7 rounded-[6px]',
                    fieldErrors.timing && 'border border-red-400 bg-red-50/40 p-4 md:p-5',
                  )}
                >
                  <TextField
                    name="travelDate"
                    label="Estimated Travel Date *"
                    placeholder="Select estimated travel date"
                    invalid={Boolean(fieldErrors.timing)}
                    describedBy={fieldErrors.timing ? fieldErrorId('timing') : undefined}
                  />
                  <SelectField
                    name="travelers"
                    label="Number of Travelers"
                    placeholder="--- Select number of travelers ---"
                    options={['1 traveler', '2 travelers', '3-4 travelers', '5-8 travelers', '9+ travelers']}
                    invalid={Boolean(fieldErrors.timing)}
                    describedBy={fieldErrors.timing ? fieldErrorId('timing') : undefined}
                  />
                  <SelectField
                    name="days"
                    label="How many days do you plan to travel?"
                    placeholder="--- Select your trip length ---"
                    options={['1-3 days', '4-6 days', '7-10 days', '11-14 days', '15+ days', 'Not sure yet']}
                    invalid={Boolean(fieldErrors.timing)}
                    describedBy={fieldErrors.timing ? fieldErrorId('timing') : undefined}
                  />
                  {fieldErrors.timing && (
                    <p id={fieldErrorId('timing')} className="text-[14px] text-red-600" role="alert">
                      {fieldErrors.timing}
                    </p>
                  )}
                </div>

                {configLoading && (
                  <p className="rounded-[6px] border border-[#e2e7ec] bg-[#f8fafc] px-5 py-4 text-[15px] text-[#63707a]">
                    Loading trip preferences…
                  </p>
                )}
                {configError && (
                  <div className="rounded-[6px] border border-red-200 bg-red-50 px-5 py-4 text-[15px] leading-7 text-red-700" role="alert">
                    <p>{configError}</p>
                  </div>
                )}
                {!configLoading && !configError && (
                  <CustomTripPreferenceSections
                    basicFields={basicFields}
                    moreFields={moreFields}
                    values={preferences}
                    errors={fieldErrors}
                    moreOpen={moreOpen}
                    onMoreOpenChange={setMoreOpen}
                    variant="desktop"
                    onChange={handlePreferenceChange}
                  />
                )}

                <fieldset>
                  <legend className="mb-4 text-[17px] font-bold text-[#122332]">Interests</legend>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {interests.map((interest) => (
                      <label
                        key={interest}
                        className="flex min-h-[54px] cursor-pointer items-center gap-4 rounded-[6px] border border-[#dce5ee] bg-[#f8fafc] px-4 text-[16px] font-semibold text-[#394a5a]"
                      >
                        <input
                          type="checkbox"
                          checked={selectedInterests.includes(interest)}
                          onChange={() => toggle(interest, selectedInterests, setSelectedInterests)}
                          className="h-[18px] w-[18px] accent-[#294f5b]"
                        />
                        {interest}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <TextField
                  name="fullName"
                  label="Full Name *"
                  placeholder="Enter your name"
                  error={fieldErrors.fullName}
                />
                <TextField
                  name="email"
                  label="Email *"
                  placeholder="Enter your email"
                  type="email"
                  error={fieldErrors.email}
                />
                <TextField name="phone" label="WhatsApp or Phone Number" placeholder="e.g. +1 555 123 4567" />
                <TextField
                  name="nationality"
                  label="Country/Region of Nationality (optional)"
                  placeholder="e.g., United States"
                  hint="As shown in your passport. This helps us check visa, entry, or travel permit requirements for your China trip. You can leave it blank for now."
                />

                <fieldset>
                  <legend className="mb-4 text-[17px] font-bold text-[#122332]">
                    How would you like us to contact you?
                  </legend>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {contactOptions.map((option) => (
                      <ChoiceBox
                        key={option}
                        name="contactPreference"
                        value={option}
                        type="checkbox"
                        label={option}
                      />
                    ))}
                  </div>
                </fieldset>

                <label className="block">
                  <span className="mb-3 block text-[17px] font-bold text-[#122332]">
                    Anything else we should know?
                  </span>
                  <textarea
                    name="message"
                    rows={8}
                    placeholder="Type here... (e.g., traveling with kids/seniors, dietary needs, must-see spots, hotel preferences)"
                    className="w-full resize-none rounded-[6px] border border-[#dce5ee] bg-[#f8fafc] px-5 py-4 text-[16px] text-[#122332] outline-none placeholder:text-[#a8b0b8] focus:border-[#294f5b]"
                  />
                </label>

                {formError && (
                  <div className="rounded-[6px] border border-red-200 bg-red-50 px-5 py-4 text-[15px] leading-7 text-red-700" role="alert">
                    <p>{formError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={configLoading || Boolean(configError)}
                  className="min-h-[58px] w-full rounded-[4px] bg-[#294f5b] px-8 text-[18px] font-bold text-white transition-colors hover:bg-[#1f3f49] disabled:cursor-not-allowed disabled:opacity-65"
                >
                  Continue to payment
                </button>
              </div>
              </form>
            </div>

            {step === 'confirm' && draft ? (
              <div className="space-y-8 px-6 pb-14 pt-16 md:px-8">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#718087]">
                    Custom trip planning
                  </p>
                  <h3 className="mt-2 font-serif text-[28px] font-medium text-[#122332]">
                    Review & payment entry
                  </h3>
                  <p className="mt-3 text-[15px] leading-7 text-[#63707a]">
                    This is the shared payment entry for private and custom trips. The payable amount
                    will be wired once the product is set.
                  </p>
                </div>

                <div className="rounded-[8px] border border-[#dce5ee] bg-[#f8fafc] p-5">
                  <h4 className="text-[15px] font-bold text-[#122332]">Request details</h4>
                  <dl className="mt-4 space-y-3">
                    {reviewRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex flex-col gap-1 border-b border-[#e8eef3] pb-3 last:border-0 last:pb-0 sm:flex-row sm:justify-between sm:gap-6"
                      >
                        <dt className="shrink-0 text-[14px] text-[#63707a]">{row.label}</dt>
                        <dd className="text-[14px] font-semibold text-[#122332] sm:text-right">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="rounded-[8px] border border-[#dce5ee] bg-[#f8fafc] p-5">
                  <h4 className="text-[15px] font-bold text-[#122332]">Payment</h4>
                  <div className="mt-4 flex items-center justify-between text-[15px] font-semibold text-[#122332]">
                    <span>Total due today</span>
                    <strong>To be confirmed</strong>
                  </div>
                  <div className="mt-4 flex gap-3 rounded-[6px] border border-[#dce5ee] bg-white px-4 py-3 text-[13px] leading-6 text-[#63707a]">
                    <ShieldCheck className="mt-0.5 shrink-0 text-[#2a9f8b]" size={18} aria-hidden="true" />
                    <p>{hostedCheckoutTrustCopy()}</p>
                  </div>
                </div>

                {(payError || emailError) && (
                  <div
                    className="rounded-[6px] border border-red-200 bg-red-50 px-5 py-4 text-[15px] leading-7 text-red-700"
                    role="alert"
                  >
                    <p>{payError || emailError}</p>
                  </div>
                )}
                {emailMessage && (
                  <p className="rounded-[6px] border border-[#CDE7E1] bg-[#F0FAF7] px-5 py-4 text-[15px] text-[#1D6F62]">
                    {emailMessage}
                  </p>
                )}

                {!emailDone ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStep('form');
                          setPayError('');
                          setPayStatus('idle');
                          setEmailError('');
                          setEmailStatus('idle');
                        }}
                        disabled={paying || sendingEmail}
                        className="min-h-[58px] w-full rounded-[4px] border border-[#B7CBC7] px-8 text-[18px] font-bold text-[#002A3A] disabled:cursor-not-allowed disabled:opacity-65"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={attemptPayment}
                        disabled={paying || sendingEmail}
                        className="min-h-[58px] w-full rounded-[4px] bg-[#ef4f43] px-8 text-[18px] font-bold text-white transition-colors hover:bg-[#d84338] disabled:cursor-not-allowed disabled:opacity-65"
                      >
                        {paying ? openingCheckoutCopy() : 'Pay full amount'}
                      </button>
                    </div>

                    <div className="space-y-4 border-t border-[#e2e7ec] pt-8">
                      <h4 className="text-[17px] font-bold text-[#122332]">Or send a planning request</h4>
                      <p className="text-[14px] leading-7 text-[#63707a]">
                        Until the payment product is configured, you can still email this request to a
                        planner.
                      </p>
                      <div data-field-error="turnstile" data-error-scroll-only>
                        <TurnstileWidget
                          onTokenChange={setTurnstileToken}
                          resetSignal={turnstileResetSignal}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void sendEmailRequest()}
                        disabled={paying || sendingEmail}
                        className="min-h-[58px] w-full rounded-[4px] border border-[#294f5b] bg-white px-8 text-[18px] font-bold text-[#294f5b] transition-colors hover:bg-[#f4f8f9] disabled:cursor-not-allowed disabled:opacity-65"
                      >
                        {sendingEmail ? 'Sending request...' : 'Send request by email'}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={resetAfterEmailSuccess}
                    className="min-h-[58px] w-full rounded-[4px] bg-[#294f5b] px-8 text-[18px] font-bold text-white transition-colors hover:bg-[#1f3f49]"
                  >
                    Plan another trip
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>

    </div>
  );
}

function TextField({
  name,
  label,
  placeholder,
  type = 'text',
  hint,
  error,
  invalid,
  describedBy,
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
  hint?: string;
  error?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const showInvalid = Boolean(error || invalid);
  const errorDescription = error ? fieldErrorId(name) : describedBy;

  return (
    <label className="block" data-field-error={error ? name : undefined}>
      <span className={cn('mb-3 block text-[17px] font-bold text-[#122332]', error && 'text-red-700')}>
        {label}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        aria-invalid={showInvalid}
        aria-describedby={errorDescription}
        className={cn(
          'min-h-[58px] w-full rounded-[6px] border border-[#dce5ee] bg-[#f8fafc] px-5 text-[16px] text-[#122332] outline-none placeholder:text-[#a8b0b8] focus:border-[#294f5b]',
          showInvalid && 'border-red-500 focus:border-red-500',
        )}
      />
      {hint && <span className="mt-2 block text-[14px] leading-6 text-[#6c747b]">{hint}</span>}
      {error && (
        <span id={fieldErrorId(name)} className="mt-2 block text-[14px] text-red-600" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

function SelectField({
  name,
  label,
  placeholder,
  options,
  hint,
  error,
  invalid,
  describedBy,
}: {
  name: string;
  label: string;
  placeholder: string;
  options: string[];
  hint?: string;
  error?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const showInvalid = Boolean(error || invalid);
  const errorDescription = error ? fieldErrorId(name) : describedBy;

  return (
    <label className="block" data-field-error={error ? name : undefined}>
      <span className={cn('mb-3 block text-[17px] font-bold text-[#122332]', error && 'text-red-700')}>
        {label}
      </span>
      <select
        name={name}
        aria-invalid={showInvalid}
        aria-describedby={errorDescription}
        className={cn(
          'min-h-[58px] w-full rounded-[6px] border border-[#dce5ee] bg-[#f8fafc] px-5 text-[16px] text-[#394a5a] outline-none focus:border-[#294f5b]',
          showInvalid && 'border-red-500 focus:border-red-500',
        )}
        defaultValue=""
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {hint && <span className="mt-2 block text-[14px] leading-6 text-[#6c747b]">{hint}</span>}
      {error && (
        <span id={fieldErrorId(name)} className="mt-2 block text-[14px] text-red-600" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

function ChoiceBox({
  name,
  value,
  type,
  label,
}: {
  name: string;
  value: string;
  type: 'radio' | 'checkbox';
  label: string;
}) {
  return (
    <label className="flex min-h-[54px] cursor-pointer items-center gap-4 rounded-[6px] border border-[#dce5ee] bg-[#f8fafc] px-4 text-[16px] font-semibold text-[#394a5a]">
      <input name={name} value={value} type={type} className="h-[18px] w-[18px] accent-[#294f5b]" />
      {label}
    </label>
  );
}
