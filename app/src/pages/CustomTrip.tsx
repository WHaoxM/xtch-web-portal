import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
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
import { cn } from '@/lib/utils';

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
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const [preferenceFields, setPreferenceFields] = useState<CustomTripFormField[]>([]);
  const [preferences, setPreferences] = useState<CustomPreferences>({});
  const [preferenceDefaults, setPreferenceDefaults] = useState<CustomPreferences>({});
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
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
      'turnstile',
    ],
    [basicFields, moreFields],
  );

  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    setConfigError('');
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
    if (!turnstileToken) nextErrors.turnstile = 'Please complete the anti-spam check.';

    setFieldErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) {
      setStatus('');
      const moreError = moreFields.some((field) => nextErrors[field.fieldKey]);
      if (moreError) setMoreOpen(true);
      requestAnimationFrame(() => {
        focusFirstFieldError([...fieldOrder], nextErrors, formElement);
      });
      return;
    }

    setSubmitting(true);
    setStatus('');

    try {
      await submitInquiry({
        type: 'custom_trip',
        requestedTour,
        requestedDestination,
        destinations: selectedDestinations,
        otherDestination,
        travelMonth: travelDate,
        travelers,
        tripLength: days,
        supportPreference: contactPreference.join(', '),
        interests: selectedInterests,
        name: fullName,
        email,
        phone: getValue('phone'),
        message: getValue('message'),
        customPreferences: preferences,
        sourcePath: window.location.href,
        turnstileToken,
        honeypot: getValue('companyWebsite'),
      });
      formElement.reset();
      setSelectedDestinations([]);
      setSelectedInterests([]);
      setPreferences(preferenceDefaults);
      setMoreOpen(false);
      setFieldErrors({});
      setTurnstileResetSignal((value) => value + 1);
      setStatus('Thank you. We received your inquiry and will reply within 24 hours.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not submit your inquiry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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

          <form
            onSubmit={handleSubmit}
            noValidate
            className="mx-auto mt-14 max-w-[930px] overflow-hidden bg-white shadow-[0_1px_18px_rgba(0,0,0,0.04)]"
          >
            <input
              type="text"
              name="companyWebsite"
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              aria-hidden="true"
            />

            <div className="relative bg-[#294f5b] px-8 pb-24 pt-16 text-center text-white md:px-14">
              <h2 className="font-serif text-[31px] font-semibold leading-tight text-[#d2aa63] md:text-[40px]">
                Syncing Travel — Your China Trip Plan
              </h2>
              <p className="mx-auto mt-7 max-w-[760px] text-[17px] font-semibold leading-9 text-white">
                Tell us your trip basics. Share your dates, group size, places you’d like to
                visit, and any special preferences. If you’re not sure yet, rough ideas are
                perfectly fine. We’ll reply within 24 hours with realistic route ideas and next
                steps.
              </p>
              <div
                className="absolute inset-x-0 bottom-[-1px] h-16 bg-white"
                style={{
                  clipPath: 'polygon(0 0, 50% 100%, 100% 0, 100% 100%, 0 100%)',
                }}
              />
            </div>

            <div className="px-6 pb-14 pt-16 md:px-8">
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
                  />
                  <SelectField
                    name="travelers"
                    label="Number of Travelers"
                    placeholder="--- Select number of travelers ---"
                    options={['1 traveler', '2 travelers', '3-4 travelers', '5-8 travelers', '9+ travelers']}
                    invalid={Boolean(fieldErrors.timing)}
                  />
                  <SelectField
                    name="days"
                    label="How many days do you plan to travel?"
                    placeholder="--- Select your trip length ---"
                    options={['1-3 days', '4-6 days', '7-10 days', '11-14 days', '15+ days', 'Not sure yet']}
                    invalid={Boolean(fieldErrors.timing)}
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

                <div
                  data-field-error="turnstile"
                  className={cn(
                    fieldErrors.turnstile && 'rounded-[6px] border border-red-400 bg-red-50/40 p-4',
                  )}
                >
                  <TurnstileWidget
                    onTokenChange={setTurnstileToken}
                    resetSignal={turnstileResetSignal}
                  />
                  {fieldErrors.turnstile && (
                    <p id={fieldErrorId('turnstile')} className="mt-2 text-[14px] text-red-600" role="alert">
                      {fieldErrors.turnstile}
                    </p>
                  )}
                </div>

                {formError && (
                  <div className="rounded-[6px] border border-red-200 bg-red-50 px-5 py-4 text-[15px] leading-7 text-red-700" role="alert">
                    <p>{formError}</p>
                  </div>
                )}
                {status && (
                  <p className="rounded-[6px] border border-[#CDE7E1] bg-[#F0FAF7] px-5 py-4 text-[15px] text-[#1D6F62]">
                    {status}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || configLoading || Boolean(configError)}
                  className="min-h-[58px] w-full rounded-[4px] bg-[#294f5b] px-8 text-[18px] font-bold text-white transition-colors hover:bg-[#1f3f49] disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {submitting ? 'Sending...' : 'Submit My Trip Plan'}
                </button>
              </div>
            </div>
          </form>
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
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
  hint?: string;
  error?: string;
  invalid?: boolean;
}) {
  const showInvalid = Boolean(error || invalid);
  const describedBy = error ? fieldErrorId(name) : undefined;

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
        aria-describedby={describedBy}
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
}: {
  name: string;
  label: string;
  placeholder: string;
  options: string[];
  hint?: string;
  error?: string;
  invalid?: boolean;
}) {
  const showInvalid = Boolean(error || invalid);
  const describedBy = error ? fieldErrorId(name) : undefined;

  return (
    <label className="block" data-field-error={error ? name : undefined}>
      <span className={cn('mb-3 block text-[17px] font-bold text-[#122332]', error && 'text-red-700')}>
        {label}
      </span>
      <select
        name={name}
        aria-invalid={showInvalid}
        aria-describedby={describedBy}
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
