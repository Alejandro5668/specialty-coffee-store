import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CardSummary, CheckoutState, initialCheckout } from './checkoutState';
import { FALLBACK } from './messages';
import { keyAssigned, placeOrder } from './placeOrder';

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState: initialCheckout,
  reducers: {
    selectCoffee(state, action: PayloadAction<{ variantId: string; quantity: number }>) {
      state.variantId = action.payload.variantId;
      state.quantity = action.payload.quantity;
      state.idempotencyKey = null;
      state.orderId = null;
    },
    // Any change to what is being bought starts a new attempt, so an old key is never reused for it.
    updateCustomer(state, action: PayloadAction<Partial<CheckoutState['customer']>>) {
      state.customer = { ...state.customer, ...action.payload };
      state.idempotencyKey = null;
    },
    updateDelivery(state, action: PayloadAction<Partial<CheckoutState['delivery']>>) {
      state.delivery = { ...state.delivery, ...action.payload };
      state.idempotencyKey = null;
    },
    setAccepted(state, action: PayloadAction<Partial<CheckoutState['accepted']>>) {
      state.accepted = { ...state.accepted, ...action.payload };
    },
    cardTokenized(state, action: PayloadAction<CardSummary>) {
      state.card = { ...action.payload };
      state.idempotencyKey = null;
    },
    cardCleared(state) {
      state.card = null;
      state.idempotencyKey = null;
    },
    /** After a failed payment: the shopper keeps the coffee and the details and tries another card. */
    retryPayment(state) {
      state.card = null;
      state.idempotencyKey = null;
      state.orderId = null;
      state.placing = 'idle';
      state.placeError = null;
    },
    orderFinished: () => initialCheckout,
    clearCheckout: () => initialCheckout,
  },
  extraReducers: (builder) => {
    builder
      .addCase(keyAssigned, (state, action) => {
        state.idempotencyKey = action.payload;
      })
      .addCase(placeOrder.pending, (state) => {
        state.placing = 'placing';
        state.placeError = null;
      })
      .addCase(placeOrder.fulfilled, (state, action) => {
        state.placing = 'idle';
        state.orderId = action.payload.id;
        state.card = null; // the token was spent on this order
      })
      .addCase(placeOrder.rejected, (state, action) => {
        if (action.meta.condition) return; // a second click that was ignored
        state.placing = 'failed';
        state.placeError = action.payload ?? FALLBACK;
      });
  },
});

export const {
  selectCoffee,
  updateCustomer,
  updateDelivery,
  setAccepted,
  cardTokenized,
  cardCleared,
  retryPayment,
  orderFinished,
  clearCheckout,
} = checkoutSlice.actions;
export const checkoutReducer = checkoutSlice.reducer;
