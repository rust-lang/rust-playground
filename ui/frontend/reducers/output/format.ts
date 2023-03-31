import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { adaptFetchError, jsonPost, routes } from '../../actions';
import { formatRequestSelector } from '../../selectors';
import RootState from '../../state';

const sliceName = 'output/format';

const initialState: State = {
  requestsInProgress: 0,
};

interface State {
  requestsInProgress: number;
  stdout?: string;
  stderr?: string;
}

interface FormatRequestBody {
  code: string;
  edition: string;
}

interface FormatResponseBody {
  success: boolean;
  code: string;
  stdout: string;
  stderr: string;
}

export const performFormat = createAsyncThunk<FormatResponseBody, void, { state: RootState }>(
  sliceName,
  async (_arg: void, { getState }) => {
    const body: FormatRequestBody = formatRequestSelector(getState());

    return adaptFetchError(() => jsonPost<FormatResponseBody>(routes.format, body));
  },
);

const slice = createSlice({
  name: sliceName,
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(performFormat.pending, (state) => {
        state.requestsInProgress += 1;
      })
      .addCase(performFormat.fulfilled, (state, action) => {
        state.requestsInProgress -= 1;
        Object.assign(state, action.payload);
      })
      .addCase(performFormat.rejected, (state) => {
        state.requestsInProgress -= 1;
      });
  },
});

export default slice.reducer;
