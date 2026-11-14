import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { ApiError } from '../api/client';
import { TransactionView } from '../api/types';
import { ThunkExtra } from './extra';
import { FALLBACK, messageOf } from './messages';

export type OrderState = {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  forId: string | null;
  view: TransactionView | null;
  error: string | null;
  /** The HTTP status of the last failure (0 when the server was never reached). */
  errorStatus: number | null;
};

type Failure = { message: string; status: number };

export const loadOrder = createAsyncThunk<
  TransactionView,
  string,
  { extra: ThunkExtra; rejectValue: Failure }
>('order/load', async (id, { extra, rejectWithValue }) => {
  try {
    return await extra.api.getTransaction(id);
  } catch (error) {
    return rejectWithValue({
      message: messageOf(error),
      status: error instanceof ApiError ? error.status : 0,
    });
  }
});

const initialState: OrderState = {
  status: 'idle',
  forId: null,
  view: null,
  error: null,
  errorStatus: null,
};

const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: { clearOrder: () => initialState },
  extraReducers: (builder) => {
    builder
      .addCase(loadOrder.pending, (state, action) => {
        // Checking the same order again keeps what is on screen; another order never shows the old one.
        if (state.forId !== action.meta.arg) state.view = null;
        state.forId = action.meta.arg;
        state.status = 'loading';
        state.error = null;
        state.errorStatus = null;
      })
      .addCase(loadOrder.fulfilled, (state, action) => {
        if (state.forId !== action.meta.arg) return;
        state.status = 'ready';
        state.view = action.payload;
      })
      .addCase(loadOrder.rejected, (state, action) => {
        if (state.forId !== action.meta.arg) return;
        state.status = 'failed';
        state.error = action.payload?.message ?? FALLBACK;
        state.errorStatus = action.payload?.status ?? 0;
      });
  },
});

export const { clearOrder } = orderSlice.actions;
export const orderReducer = orderSlice.reducer;
