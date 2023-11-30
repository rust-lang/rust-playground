import { Draft, PayloadAction, createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as z from 'zod';

import { adaptFetchError, jsonGet, jsonPost, routes } from '../../api';
import { baseUrlSelector, codeSelector } from '../../selectors';
import RootState from '../../state';
import { Channel, Edition, Mode } from '../../types';

const sliceName = 'output/gist';

const initialState: State = {
  requestsInProgress: 0,
};

interface State {
  requestsInProgress: number;
  id?: string;
  url?: string;
  code?: string;
  stdout?: string;
  stderr?: string;
  channel?: Channel;
  mode?: Mode;
  edition?: Edition;
}

interface SuccessProps {
  id: string;
  url: string;
  code: string;
  stdout: string;
  stderr: string;
  channel: Channel;
  mode: Mode;
  edition: Edition;
}

type PerformGistLoadProps = Pick<
  SuccessProps,
  Exclude<keyof SuccessProps, 'url' | 'code' | 'stdout' | 'stderr'>
>;

const GistResponseBody = z.object({
  id: z.string(),
  url: z.string(),
  code: z.string(),
});
type GistResponseBody = z.infer<typeof GistResponseBody>;

export const performGistLoad = createAsyncThunk<
  SuccessProps,
  PerformGistLoadProps,
  { state: RootState }
>(`${sliceName}/load`, async ({ id, channel, mode, edition }, { getState }) => {
  const state = getState();
  const baseUrl = baseUrlSelector(state);
  const gistUrl = new URL(routes.meta.gistLoad, baseUrl);
  const u = new URL(id, gistUrl);

  const d = await adaptFetchError(() => jsonGet(u));
  const gist = await GistResponseBody.parseAsync(d);
  return { ...gist, channel, mode, edition, stdout: '', stderr: '' };
});

export const performGistSave = createAsyncThunk<SuccessProps, void, { state: RootState }>(
  `${sliceName}/save`,
  async (_arg, { getState }) => {
    const state = getState();
    const code = codeSelector(state);
    const {
      configuration: { channel, mode, edition },
      output: {
        execute: { stdout = '', stderr = '' },
      },
    } = state;

    const d = await adaptFetchError(() => jsonPost(routes.meta.gistSave, { code }));
    const gist = await GistResponseBody.parseAsync(d);
    return { ...gist, code, stdout, stderr, channel, mode, edition };
  },
);

const pending = (state: Draft<State>) => {
  state.requestsInProgress += 1;
};

const fulfilled = (state: Draft<State>, action: PayloadAction<SuccessProps>) => {
  state.requestsInProgress -= 1;
  Object.assign(state, action.payload);
};

const slice = createSlice({
  name: sliceName,
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(performGistLoad.pending, pending)
      .addCase(performGistLoad.fulfilled, fulfilled)
      .addCase(performGistSave.pending, pending)
      .addCase(performGistSave.fulfilled, fulfilled);
  },
});

export default slice.reducer;
