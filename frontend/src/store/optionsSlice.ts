import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { CheckoutOptions } from '../api/types';
import { ThunkExtra } from './extra';
import { FALLBACK, messageOf } from './messages';

export type OptionsState = {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  data: CheckoutOptions | null;
  error: string | null;
  /** When the tokens arrived; they stop being usable after OPTIONS_TTL_MS. */
  loadedAt: number | null;
};

/** The provider's acceptance tokens last 60 minutes; half of that leaves a wide margin. */
export const OPTIONS_TTL_MS = 30 * 60 * 1000;

export const isOptionsFresh = (state: OptionsState, now: number): boolean =>
  state.status === 'ready' &&
  state.data !== null &&
  state.loadedAt !== null &&
  now - state.loadedAt < OPTIONS_TTL_MS;

export const loadOptions = createAsyncThunk<
  { data: CheckoutOptions; loadedAt: number },
  void,
  { extra: ThunkExtra; rejectValue: string }
>('options/load', async (_arg, { extra, rejectWithValue }) => {
  try {
    const data = await extra.api.getCheckoutOptions();
    return { data, loadedAt: extra.now() };
  } catch (error) {
    return rejectWithValue(messageOf(error));
  }
});

const initialState: OptionsState = { status: 'idle', data: null, error: null, loadedAt: null };

const optionsSlice = createSlice({
  name: 'options',
  initialState,
  reducers: {
    /**
     * The tokens are single use: once a payment takes them they must never be sent again. The fees
     * stay, so the summary keeps showing the amounts while the payment runs.
     */
    optionsUsed: (state) => {
      state.loadedAt = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadOptions.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadOptions.fulfilled, (state, action) => {
        state.status = 'ready';
        state.data = action.payload.data;
        state.loadedAt = action.payload.loadedAt;
      })
      .addCase(loadOptions.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? FALLBACK;
      });
  },
});

export const { optionsUsed } = optionsSlice.actions;
export const optionsReducer = optionsSlice.reducer;
