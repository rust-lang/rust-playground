import { AnyAction, Draft, createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as z from 'zod';

import { SimpleThunkAction, adaptFetchError, jsonPost, routes } from '../../actions';
import { executeRequestPayloadSelector, executeViaWebsocketSelector } from '../../selectors';
import { Channel, Edition, Mode } from '../../types';
import {
  WsPayloadAction,
  createWebsocketResponse,
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

type wsExecuteRequestPayload = {
  channel: Channel;
  mode: Mode;
  edition: Edition;
  crateType: string;
  tests: boolean;
  code: string;
  backtrace: boolean;
};

const { action: wsExecuteBegin, schema: wsExecuteBeginSchema } = createWebsocketResponse(
  'output/execute/wsExecuteBegin',
  z.undefined(),
);

const { action: wsExecuteStdout, schema: wsExecuteStdoutSchema } = createWebsocketResponse(
  'output/execute/wsExecuteStdout',
  z.string(),
);

const { action: wsExecuteStderr, schema: wsExecuteStderrSchema } = createWebsocketResponse(
  'output/execute/wsExecuteStderr',
  z.string(),
);

const { action: wsExecuteEnd, schema: wsExecuteEndSchema } = createWebsocketResponse(
  'output/execute/wsExecuteEnd',
  z.object({
    success: z.boolean(),
    exitDetail: z.string(),
  }),
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
  exitDetail: string;
  stdout: string;
  stderr: string;
}

export const performExecute = createAsyncThunk(sliceName, async (payload: ExecuteRequestBody) =>
  adaptFetchError(() => jsonPost<ExecuteResponseBody>(routes.execute, payload)),
);

const prepareWithCurrentSequenceNumber = <P>(payload: P, sequenceNumber: number) => ({
  payload,
  meta: {
    websocket: true,
    sequenceNumber,
  },
});

const sequenceNumberMatches =
  <P>(whenMatch: (state: Draft<State>, payload: P) => void) =>
  (state: Draft<State>, action: WsPayloadAction<P>) => {
    const {
      payload,
      meta: { sequenceNumber },
    } = action;

    if (sequenceNumber === state.sequenceNumber) {
      whenMatch(state, payload);
    }
  };

const slice = createSlice({
  name: 'output/execute',
  initialState,
  reducers: {
    wsExecuteRequest: {
      reducer: (state, action: WsPayloadAction<wsExecuteRequestPayload>) => {
        const { sequenceNumber } = action.meta;
        if (sequenceNumber >= (state.sequenceNumber ?? 0)) {
          state.sequenceNumber = sequenceNumber;
        }
      },

      prepare: (payload: wsExecuteRequestPayload) => ({
        payload,
        meta: makeWebSocketMeta(),
      }),
    },
    wsExecuteStdin: {
      reducer: () => {},

      prepare: prepareWithCurrentSequenceNumber,
    },
    wsExecuteStdinClose: {
      reducer: () => {},

      prepare: prepareWithCurrentSequenceNumber,
    },
    wsExecuteKill: {
      reducer: () => {},

      prepare: prepareWithCurrentSequenceNumber,
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(performExecute.pending, (state) => {
        state.requestsInProgress += 1;
      })
      .addCase(performExecute.fulfilled, (state, action) => {
        const { success, exitDetail, stdout, stderr } = action.payload;
        Object.assign(state, { stdout, stderr });
        delete state.error;
        if (!success) {
          state.error = exitDetail;
        }
        state.requestsInProgress -= 1;
      })
      .addCase(performExecute.rejected, (state, action) => {
        if (action.payload) {
        } else {
          state.error = action.error.message;
        }
        state.requestsInProgress -= 1;
      })
      .addCase(
        wsExecuteBegin,
        sequenceNumberMatches((state) => {
          state.requestsInProgress = 1; // Only tracking one request
          state.stdout = '';
          state.stderr = '';
          delete state.error;
        }),
      )
      .addCase(
        wsExecuteStdout,
        sequenceNumberMatches((state, payload) => {
          state.stdout += payload;
        }),
      )
      .addCase(
        wsExecuteStderr,
        sequenceNumberMatches((state, payload) => {
          state.stderr += payload;
        }),
      )
      .addCase(
        wsExecuteEnd,
        sequenceNumberMatches((state, payload) => {
          state.requestsInProgress = 0; // Only tracking one request
          delete state.sequenceNumber;

          if (!payload.success) {
            state.error = payload.exitDetail;
          }
        }),
      );
  },
});

export const { wsExecuteRequest } = slice.actions;

export const performCommonExecute =
  (crateType: string, tests: boolean): SimpleThunkAction =>
  (dispatch, getState) => {
    const state = getState();
    const body = executeRequestPayloadSelector(state, { crateType, tests });
    const useWebSocket = executeViaWebsocketSelector(state);

    if (useWebSocket) {
      dispatch(wsExecuteRequest(body));
    } else {
      dispatch(performExecute(body));
    }
  };

const dispatchWhenSequenceNumber =
  <A extends AnyAction>(cb: (sequenceNumber: number) => A): SimpleThunkAction =>
  (dispatch, getState) => {
    const state = getState();
    const { sequenceNumber } = state.output.execute;
    if (sequenceNumber) {
      const action = cb(sequenceNumber);
      dispatch(action);
    }
  };

export const wsExecuteStdin = (payload: string): SimpleThunkAction =>
  dispatchWhenSequenceNumber((sequenceNumber) =>
    slice.actions.wsExecuteStdin(payload, sequenceNumber),
  );

export const wsExecuteStdinClose = (): SimpleThunkAction =>
  dispatchWhenSequenceNumber((sequenceNumber) =>
    slice.actions.wsExecuteStdinClose(undefined, sequenceNumber),
  );

export const wsExecuteKill = (): SimpleThunkAction =>
  dispatchWhenSequenceNumber((sequenceNumber) =>
    slice.actions.wsExecuteKill(undefined, sequenceNumber),
  );

export { wsExecuteBeginSchema, wsExecuteStdoutSchema, wsExecuteStderrSchema, wsExecuteEndSchema };

export default slice.reducer;
