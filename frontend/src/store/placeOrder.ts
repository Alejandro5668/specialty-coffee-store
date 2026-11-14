import { createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { TransactionView } from '../api/types';
import { normalizePhone } from '../features/checkout/lib/details';
import { CheckoutState, isCardFresh } from './checkoutState';
import { ThunkExtra } from './extra';
import { messageOf } from './messages';

export const keyAssigned = createAction<string>('checkout/keyAssigned');

const CHECK_DETAILS = 'Check your details and try again.';

type Config = { state: { checkout: CheckoutState }; extra: ThunkExtra; rejectValue: string };

/**
 * Places the order. It reads everything from the saved draft, so nothing sensitive travels as an
 * argument (and so never shows up in an action log). The server computes every amount.
 */
export const placeOrder = createAsyncThunk<TransactionView, void, Config>(
  'checkout/placeOrder',
  async (_arg, { getState, dispatch, extra, rejectWithValue }) => {
    const s = getState().checkout;
    if (
      !s.variantId ||
      !isCardFresh(s.card, extra.now()) ||
      !s.accepted.terms ||
      !s.accepted.personalData
    ) {
      return rejectWithValue(CHECK_DETAILS);
    }

    // The key is saved before the request leaves: if the page is refreshed in the middle, paying
    // again sends the same key and the server answers with the same order, never a second charge.
    const idempotencyKey = s.idempotencyKey ?? extra.newId();
    if (!s.idempotencyKey) dispatch(keyAssigned(idempotencyKey));

    try {
      // Acceptance tokens are single use, so they are fetched right before paying.
      const options = await extra.api.getCheckoutOptions();
      return await extra.api.createOrder({
        idempotencyKey,
        variantId: s.variantId,
        quantity: s.quantity,
        customer: { name: s.customer.name.trim(), email: s.customer.email.trim() },
        delivery: {
          recipientName: s.delivery.recipientName.trim() || s.customer.name.trim(),
          address: s.delivery.address.trim(),
          city: s.delivery.city.trim(),
          phone: normalizePhone(s.delivery.phone),
        },
        cardToken: s.card.token,
        acceptanceToken: options.acceptance.token,
        personalAuthToken: options.personalData.token,
      });
    } catch (error) {
      return rejectWithValue(messageOf(error));
    }
  },
  // A second click while the first is still running does nothing.
  { condition: (_arg, { getState }) => getState().checkout.placing !== 'placing' },
);
