import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as z from 'zod';

import { SimpleThunkAction, adaptFetchError, jsonPost, routes } from '../../actions';
import { executeRequestPayloadSelector, useWebsocketSelector } from '../../selectors';
import { Channel, Edition, Mode } from '../../types';
import {
  WsPayloadAction,
  createWebsocketResponseAction,
  createWebsocketResponseSchema,
  makeWebSocketMeta,
} from '../../websocketActions';

const initialState: State = {
  requestsInProgress: 0,
};

interface State {
  sequenceNumber?: number;
  requestsInProgress: number;
  stdout?: string;
  stderr?: string;
  error?: string;
}

const wsExecuteResponsePayloadSchema = z.object({
  success: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
});
type wsExecuteResponsePayload = z.infer<typeof wsExecuteResponsePayloadSchema>;

type wsExecuteRequestPayload = {
  channel: Channel;
  mode: Mode;
  edition: Edition;
  crateType: string;
  tests: boolean;
  code: string;
  backtrace: boolean;
};

const wsExecuteResponse = createWebsocketResponseAction<wsExecuteResponsePayload>(
  'output/execute/wsExecuteResponse',
);

const sliceName = 'output/execute';

export interface ExecuteRequestBody {
  channel: string;
  mode: string;
  crateType: string;
  tests: boolean;
  code: string;
  edition: string;
  backtrace: boolean;
}

interface ExecuteResponseBody {
  success: boolean;
  stdout: string;
  stderr: string;
}

export const performExecute = createAsyncThunk(sliceName, async (payload: ExecuteRequestBody) =>
  adaptFetchError(() => jsonPost<ExecuteResponseBody>(routes.execute, payload)),
);

const slice = createSlice({
  name: 'output/execute',
  initialState,
  reducers: {
    wsExecuteRequest: {
      reducer: (state, action: WsPayloadAction<wsExecuteRequestPayload>) => {
        const { sequenceNumber } = action.meta;
        if (sequenceNumber >= (state.sequenceNumber ?? 0)) {
          state.sequenceNumber = sequenceNumber;
          state.requestsInProgress = 1; // Only tracking one request
        }
      },

      prepare: (payload: wsExecuteRequestPayload) => ({
        payload,
        meta: makeWebSocketMeta(),
      }),
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(performExecute.pending, (state) => {
        state.requestsInProgress += 1;
      })
      .addCase(performExecute.fulfilled, (state, action) => {
        const { stdout, stderr } = action.payload;
        Object.assign(state, { stdout, stderr });
        state.requestsInProgress -= 1;
      })
      .addCase(performExecute.rejected, (state, action) => {
        if (action.payload) {
        } else {
          state.error = action.error.message;
        }
        state.requestsInProgress -= 1;
      })
      .addCase(wsExecuteResponse, (state, action) => {
        const {
          payload: { stdout, stderr },
          meta: { sequenceNumber },
        } = action;

        if (sequenceNumber >= (state.sequenceNumber ?? 0)) {
          Object.assign(state, { stdout, stderr });
          state.requestsInProgress = 0; // Only tracking one request
        }
      });
  },
});

export const { wsExecuteRequest } = slice.actions;

export const performCommonExecute =
  (crateType: string, tests: boolean): SimpleThunkAction =>
  (dispatch, getState) => {
    const state = getState();
    const body = executeRequestPayloadSelector(state, { crateType, tests });
    const useWebSocket = useWebsocketSelector(state);

    if (useWebSocket) {
      dispatch(wsExecuteRequest(body));
    } else {
      dispatch(performExecute(body));
    }
  };

export const wsExecuteResponseSchema = createWebsocketResponseSchema(
  wsExecuteResponse,
  wsExecuteResponsePayloadSchema,
);

export default slice.reducer;
