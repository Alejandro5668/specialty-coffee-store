import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { CheckoutOptions } from '../api/types';
import { ThunkExtra } from './extra';
import { FALLBACK, messageOf } from './messages';

export type OptionsState = {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  data: CheckoutOptions | null;
  error: string | null;
};

export const loadOptions = createAsyncThunk<
  CheckoutOptions,
  void,
  { extra: ThunkExtra; rejectValue: string }
>('options/load', async (_arg, { extra, rejectWithValue }) => {
  try {
    return await extra.api.getCheckoutOptions();
  } catch (error) {
    return rejectWithValue(messageOf(error));
  }
});

const initialState: OptionsState = { status: 'idle', data: null, error: null };

const optionsSlice = createSlice({
  name: 'options',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadOptions.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadOptions.fulfilled, (state, action) => {
        state.status = 'ready';
        state.data = action.payload;
      })
      .addCase(loadOptions.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? FALLBACK;
      });
  },
});

export const optionsReducer = optionsSlice.reducer;
