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
            Intentar de nuevo
          </Button>
        </div>
      )}
      {formError && (
        <div role="alert" className="notice notice--error">
          <p>{formError}</p>
        </div>
      )}

      <p className="field__hint details__notice">
        Todos los campos son obligatorios, salvo los marcados como opcionales.
      </p>

      <fieldset className="details__group">
        <legend>Tarjeta</legend>
        {savedCard ? (
          <div className="details__saved">
            <CardBrandMark brand={savedCard.brand} />
            <p>
              {brandName(savedCard.brand)} terminada en {savedCard.last4}
            </p>
            <Button variant="quiet" onClick={onUseAnotherCard}>
              Usar otra tarjeta
            </Button>
          </div>
        ) : (
          <>
            {text('number', 'Número de tarjeta', {
              inputMode: 'numeric',
              autoComplete: 'cc-number',
              maxLength: 23,
              hint: 'Aceptamos Visa y Mastercard.',
              trailing: <CardBrandMark brand={brand} />,
            })}
            <div className="details__pair">
              {text('expiry', 'Fecha de vencimiento', {
                inputMode: 'numeric',
                autoComplete: 'cc-exp',
                maxLength: 7,
                hint: 'Por ejemplo, 12 / 30.',
              })}
              {text('cvc', 'Código de seguridad', {
                inputMode: 'numeric',
                autoComplete: 'cc-csc',
                maxLength: 3,
                hint: '3 dígitos en el reverso.',
              })}
            </div>
            {text('holder', 'Nombre en la tarjeta', { autoComplete: 'cc-name' })}
          </>
        )}
      </fieldset>

      <fieldset className="details__group">
        <legend>Tus datos</legend>
        {text('name', 'Nombre completo', { autoComplete: 'name' })}
        {text('email', 'Correo electrónico', {
          type: 'email',
          inputMode: 'email',
          autoComplete: 'email',
        })}
      </fieldset>

      <fieldset className="details__group">
        <legend>Entrega</legend>
        {text('recipientName', 'Nombre del destinatario (opcional)', {
          autoComplete: 'shipping name',
          hint: 'Si lo dejas vacío, usamos tu nombre.',
        })}
        {text('address', 'Dirección', { autoComplete: 'shipping street-address' })}
        {text('city', 'Ciudad', { autoComplete: 'shipping address-level2' })}
        {text('phone', 'Teléfono', {
          type: 'tel',
          inputMode: 'tel',
          autoComplete: 'tel',
          hint: 'Incluye el indicativo.',
        })}
      </fieldset>

      <fieldset className="details__group">
        <legend className="visually-hidden">Términos</legend>
        <Checkbox
          checked={accepted.terms}
          error={errors.terms ?? null}
          onChange={(checked) => onAccept('terms', checked)}
        >
          Acepto los {link(terms.links?.terms, 'términos y condiciones')}.
        </Checkbox>
        <Checkbox
          checked={accepted.personalData}
          error={errors.personalData ?? null}
          onChange={(checked) => onAccept('personalData', checked)}
        >
          Autorizo el uso de mis {link(terms.links?.personalData, 'datos personales')} para procesar
          este pedido.
        </Checkbox>
      </fieldset>

      {terms.status === 'loading' && <p className="field__hint">Cargando los términos…</p>}
      <Button block type="submit" disabled={busy || terms.status !== 'ready'}>
        {busy ? 'Verificando tu tarjeta…' : 'Continuar al resumen'}
      </Button>
    </form>
  );
};
