import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as z from 'zod';

import { adaptFetchError, jsonGet, routes } from '../actions';
import { ChannelVersion } from '../types';

const sliceName = 'versions';

const initialState: State = {};

type State = Partial<Response>;

const Response = z.object({
  stable: ChannelVersion,
  beta: ChannelVersion,
  nightly: ChannelVersion,
});

type Response = z.infer<typeof Response>;

export const performVersionsLoad = createAsyncThunk(sliceName, async () => {
  const d = await adaptFetchError(() => jsonGet(routes.meta.versions));
  return Response.parseAsync(d);
});

const slice = createSlice({
  name: sliceName,
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(performVersionsLoad.fulfilled, (state, versions) => {
      Object.assign(state, versions.payload);
    });
  },
});

export default slice.reducer;
