import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type CheckoutState = { variantId: string | null; quantity: number };

const initialState: CheckoutState = { variantId: null, quantity: 1 };

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    selectCoffee(_state, action: PayloadAction<{ variantId: string; quantity: number }>) {
      return { ...action.payload };
    },
    clearCheckout: () => initialState,
  },
});

export const { selectCoffee, clearCheckout } = checkoutSlice.actions;
export const checkoutReducer = checkoutSlice.reducer;
