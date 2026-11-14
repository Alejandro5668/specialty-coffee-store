import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { ApiError, CoffeeApi } from '../api/client';
import { ProductView } from '../api/types';

export type CatalogState = {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  products: ProductView[];
  error: string | null;
};

export type ThunkExtra = { api: CoffeeApi };

const FALLBACK = 'Something went wrong. Try again in a minute.';

export const loadCatalog = createAsyncThunk<
  ProductView[],
  void,
  { extra: ThunkExtra; rejectValue: string }
>('catalog/load', async (_arg, { extra, rejectWithValue }) => {
  try {
    return await extra.api.listProducts();
  } catch (error) {
    // Only messages written for shoppers reach the screen, never a raw error.
    return rejectWithValue(error instanceof ApiError ? error.message : FALLBACK);
  }
});

const initialState: CatalogState = { status: 'idle', products: [], error: null };

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Products already on screen stay while the stock refreshes.
      .addCase(loadCatalog.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadCatalog.fulfilled, (state, action) => {
        state.status = 'ready';
        state.products = action.payload;
      })
      .addCase(loadCatalog.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? FALLBACK;
      });
  },
});

export const catalogReducer = catalogSlice.reducer;
