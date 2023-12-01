import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { sortBy } from 'lodash-es';
import * as z from 'zod';

import { adaptFetchError, jsonGet, routes } from '../actions';
import { Crate } from '../types';

const sliceName = 'crates';

const initialState: State = [];

export type State = Crate[];

const CratesResponse = z.object({
  crates: Crate.array(),
});
type CratesResponse = z.infer<typeof CratesResponse>;

export const performCratesLoad = createAsyncThunk(sliceName, async () => {
  const d = await adaptFetchError(() => jsonGet(routes.meta.crates));
  const crates = await CratesResponse.parseAsync(d);
  return sortBy(crates.crates, (c) => c.name);
});

const slice = createSlice({
  name: sliceName,
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(performCratesLoad.fulfilled, (_state, action) => {
      return action.payload;
    });
  },
});

export default slice.reducer;
