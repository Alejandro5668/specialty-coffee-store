import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { TokenizeError } from '../../../api/tokenizer';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { useServices } from '../../../app/services';
import {
  cardCleared,
  cardTokenized,
  setAccepted,
  updateCustomer,
  updateDelivery,
} from '../../../store/checkoutSlice';
import { isCardFresh } from '../../../store/checkoutState';
import { FALLBACK } from '../../../store/messages';
import { loadOptions } from '../../../store/optionsSlice';
import { Modal } from '../../../ui/organisms/Modal';
import { DetailsForm } from '../components/DetailsForm';
import { Errors, Field, Values } from '../components/detailsTypes';
import {
  detectBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  splitExpiry,
  validateCardNumber,
  validateCvc,
  validateExpiry,
  validateHolder,
} from '../lib/card';
import {
  validateAddress,
  validateCity,
  validateEmail,
  validateFullName,
  validatePhone,
  validateRecipient,
} from '../lib/details';

const EMPTY_CARD = { number: '', expiry: '', cvc: '', holder: '' };

export const DetailsContainer = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { tokenizer, now } = useServices();
  const checkout = useAppSelector((state) => state.checkout);
  const options = useAppSelector((state) => state.options);

  // The card lives only here, in this form's own state. It never goes to Redux, to an action or to storage.
  const [card, setCard] = useState(EMPTY_CARD);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const [useSaved, setUseSaved] = useState(() => isCardFresh(checkout.card, now()));

  useEffect(() => {
    if (options.status === 'idle') void dispatch(loadOptions());
  }, [dispatch, options.status]);

  if (!checkout.variantId) return <Navigate to="/" replace />;
  if (checkout.orderId) return <Navigate to={`/order/${checkout.orderId}`} replace />;

  const values: Values = {
    ...card,
    name: checkout.customer.name,
    email: checkout.customer.email,
    recipientName: checkout.delivery.recipientName,
    address: checkout.delivery.address,
    city: checkout.delivery.city,
    phone: checkout.delivery.phone,
  };

  const change = (field: Field, value: string) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (field === 'number') setCard((c) => ({ ...c, number: formatCardNumber(value) }));
    else if (field === 'expiry') setCard((c) => ({ ...c, expiry: formatExpiry(value) }));
    else if (field === 'cvc') setCard((c) => ({ ...c, cvc: digitsOnly(value).slice(0, 3) }));
    else if (field === 'holder') setCard((c) => ({ ...c, holder: value }));
    else if (field === 'name' || field === 'email') dispatch(updateCustomer({ [field]: value }));
    else dispatch(updateDelivery({ [field]: value }));
  };

  const validate = (): Errors => {
    const found: Errors = {};
    if (!useSaved) {
      found.number = validateCardNumber(card.number) ?? undefined;
      found.expiry = validateExpiry(card.expiry, new Date(now())) ?? undefined;
      found.cvc = validateCvc(card.cvc) ?? undefined;
      found.holder = validateHolder(card.holder) ?? undefined;
    }
    found.name = validateFullName(checkout.customer.name) ?? undefined;
    found.email = validateEmail(checkout.customer.email) ?? undefined;
    found.recipientName = validateRecipient(checkout.delivery.recipientName) ?? undefined;
    found.address = validateAddress(checkout.delivery.address) ?? undefined;
    found.city = validateCity(checkout.delivery.city) ?? undefined;
    found.phone = validatePhone(checkout.delivery.phone) ?? undefined;
    if (!checkout.accepted.terms) found.terms = 'Accept the terms and conditions to continue.';
    if (!checkout.accepted.personalData)
      found.personalData = 'Authorize the use of your personal data to continue.';
    return Object.fromEntries(Object.entries(found).filter(([, message]) => message)) as Errors;
  };

  const submit = async () => {
    if (busy) return;
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFocusSignal((n) => n + 1);
      return;
    }

    if (useSaved) {
      if (isCardFresh(checkout.card, now())) {
        navigate('/checkout/summary');
        return;
      }
      // The saved token went stale while the form was open.
      dispatch(cardCleared());
      setUseSaved(false);
      setFormError('Your saved card is no longer valid. Enter it again.');
      return;
    }

    const expiry = splitExpiry(card.expiry);
    if (!expiry) return;
    setBusy(true);
    try {
      const tokenized = await tokenizer.tokenize({
        number: digitsOnly(card.number),
        cvc: card.cvc,
        ...expiry,
        holder: card.holder.trim(),
      });
      setCard(EMPTY_CARD);
      dispatch(cardTokenized({ ...tokenized, at: now() }));
      navigate('/checkout/summary');
    } catch (error) {
      if (error instanceof TokenizeError && error.field) {
        setErrors({ [error.field]: error.message });
        setFocusSignal((n) => n + 1);
      } else {
        setFormError(error instanceof TokenizeError ? error.message : FALLBACK);
      }
    } finally {
      setBusy(false);
    }
  };

  const useAnotherCard = () => {
    dispatch(cardCleared());
    setUseSaved(false);
  };

  const links = options.data
    ? {
        terms: options.data.acceptance.permalink,
        personalData: options.data.personalData.permalink,
      }
    : null;

  return (
    <Modal title="Card and delivery" onClose={() => navigate('/')}>
      <DetailsForm
        values={values}
        errors={errors}
        brand={detectBrand(digitsOnly(card.number))}
        accepted={checkout.accepted}
        terms={{
          status:
            options.status === 'ready'
              ? 'ready'
              : options.status === 'failed'
                ? 'failed'
                : 'loading',
          links,
          error: options.error,
          onRetry: () => void dispatch(loadOptions()),
        }}
        savedCard={
          useSaved && checkout.card
            ? { brand: checkout.card.brand, last4: checkout.card.last4 }
            : null
        }
        busy={busy}
        formError={formError}
        focusSignal={focusSignal}
        onChange={change}
        onAccept={(key, checked) => {
          setErrors((current) => ({ ...current, [key]: undefined }));
          dispatch(setAccepted({ [key]: checked }));
        }}
        onUseAnotherCard={useAnotherCard}
        onSubmit={() => void submit()}
      />
    </Modal>
  );
};
