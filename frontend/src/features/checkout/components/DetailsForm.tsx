import { useEffect, useRef } from 'react';
import { CardBrand } from '../../../api/types';
import { Button } from '../../../ui/atoms/Button';
import { CardBrandMark } from '../../../ui/atoms/CardBrandMark';
import { Checkbox } from '../../../ui/atoms/Checkbox';
import { TextField } from '../../../ui/atoms/TextField';
import { brandName } from '../lib/card';
import { Errors, Field, Values } from './detailsTypes';
import './details-form.css';

type Terms = {
  status: 'loading' | 'ready' | 'failed';
  links: { terms: string; personalData: string } | null;
  error: string | null;
  onRetry: () => void;
};

type Props = {
  values: Values;
  errors: Errors;
  brand: CardBrand;
  accepted: { terms: boolean; personalData: boolean };
  terms: Terms;
  savedCard: { brand: CardBrand; last4: string } | null;
  busy: boolean;
  formError: string | null;
  /** Changes every time a submit found problems, so the first one can take the focus. */
  focusSignal: number;
  onChange: (field: Field, value: string) => void;
  onAccept: (key: 'terms' | 'personalData', checked: boolean) => void;
  onUseAnotherCard: () => void;
  onSubmit: () => void;
};

const link = (href: string | undefined, text: string) =>
  href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  ) : (
    text
  );

export const DetailsForm = ({
  values,
  errors,
  brand,
  accepted,
  terms,
  savedCard,
  busy,
  formError,
  focusSignal,
  onChange,
  onAccept,
  onUseAnotherCard,
  onSubmit,
}: Props) => {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (focusSignal > 0)
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusSignal]);

  const text = (
    field: Field,
    label: string,
    extra: Partial<Parameters<typeof TextField>[0]> = {},
  ) => (
    <TextField
      label={label}
      name={field}
      value={values[field]}
      error={errors[field]}
      onChange={(value) => onChange(field, value)}
      {...extra}
    />
  );

  return (
    <form
      ref={formRef}
      noValidate
      className="details stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {terms.status === 'failed' && (
        <div role="alert" className="notice notice--error stack">
          <p>{terms.error}</p>
          <Button variant="quiet" onClick={terms.onRetry}>
            Try again
          </Button>
        </div>
      )}
      {formError && (
        <div role="alert" className="notice notice--error">
          <p>{formError}</p>
        </div>
      )}

      <p className="field__hint">All fields are required unless marked optional.</p>

      <fieldset className="details__group">
        <legend>Card</legend>
        {savedCard ? (
          <div className="details__saved">
            <CardBrandMark brand={savedCard.brand} />
            <p>
              {brandName(savedCard.brand)} ending {savedCard.last4}
            </p>
            <Button variant="quiet" onClick={onUseAnotherCard}>
              Use another card
            </Button>
          </div>
        ) : (
          <>
            {text('number', 'Card number', {
              inputMode: 'numeric',
              autoComplete: 'cc-number',
              maxLength: 23,
              hint: 'We accept Visa and Mastercard.',
              trailing: <CardBrandMark brand={brand} />,
            })}
            <div className="details__pair">
              {text('expiry', 'Expiry date', {
                inputMode: 'numeric',
                autoComplete: 'cc-exp',
                maxLength: 7,
                hint: 'Like 12 / 30.',
              })}
              {text('cvc', 'Security code', {
                inputMode: 'numeric',
                autoComplete: 'cc-csc',
                maxLength: 3,
                hint: '3 digits on the back.',
              })}
            </div>
            {text('holder', 'Name on the card', { autoComplete: 'cc-name' })}
          </>
        )}
      </fieldset>

      <fieldset className="details__group">
        <legend>Your details</legend>
        {text('name', 'Full name', { autoComplete: 'name' })}
        {text('email', 'Email', { type: 'email', inputMode: 'email', autoComplete: 'email' })}
      </fieldset>

      <fieldset className="details__group">
        <legend>Delivery</legend>
        {text('recipientName', 'Recipient name (optional)', {
          autoComplete: 'shipping name',
          hint: 'Leave it empty and we use your name.',
        })}
        {text('address', 'Address', { autoComplete: 'shipping street-address' })}
        {text('city', 'City', { autoComplete: 'shipping address-level2' })}
        {text('phone', 'Phone', {
          type: 'tel',
          inputMode: 'tel',
          autoComplete: 'tel',
          hint: 'Include the area code.',
        })}
      </fieldset>

      <fieldset className="details__group">
        <legend className="visually-hidden">Terms</legend>
        <Checkbox
          checked={accepted.terms}
          error={errors.terms ?? null}
          onChange={(checked) => onAccept('terms', checked)}
        >
          I accept the {link(terms.links?.terms, 'terms and conditions')}.
        </Checkbox>
        <Checkbox
          checked={accepted.personalData}
          error={errors.personalData ?? null}
          onChange={(checked) => onAccept('personalData', checked)}
        >
          I authorize the use of my {link(terms.links?.personalData, 'personal data')} to process
          this order.
        </Checkbox>
      </fieldset>

      {terms.status === 'loading' && <p className="field__hint">Loading the terms…</p>}
      <Button block type="submit" disabled={busy || terms.status !== 'ready'}>
        {busy ? 'Checking your card…' : 'Continue to summary'}
      </Button>
    </form>
  );
};
