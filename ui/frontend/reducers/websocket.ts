import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import z from 'zod';

import { createWebsocketResponseSchema, makeWebSocketMeta } from '../websocketActions';

export type State = {
  connected: boolean;
  error?: string;
};

const initialState: State = {
  connected: false,
};

const websocketConnectedPayloadSchema = z.object({
  iAcceptThisIsAnUnsupportedApi: z.boolean(),
});
type websocketConnectedPayload = z.infer<typeof websocketConnectedPayloadSchema>;

const websocketErrorPayloadSchema = z.object({
  error: z.string(),
});
type websocketErrorPayload = z.infer<typeof websocketErrorPayloadSchema>;

const slice = createSlice({
  name: 'websocket',
  initialState,
  reducers: {
    connected: {
      reducer: (state, _action: PayloadAction<websocketConnectedPayload>) => {
        state.connected = true;
        delete state.error;
      },

      prepare: () => ({
        payload: {
          iAcceptThisIsAnUnsupportedApi: true,
        },
        meta: makeWebSocketMeta(),
      }),
    },

    disconnected: (state) => {
      state.connected = false;
    },

    error: (state, action: PayloadAction<websocketErrorPayload>) => {
      state.error = action.payload.error;
    },
  },
});

export const {
  connected: websocketConnected,
  disconnected: websocketDisconnected,
  error: websocketError,
} = slice.actions;

export const websocketConnectedSchema = createWebsocketResponseSchema(
  websocketConnected,
  websocketConnectedPayloadSchema,
);

export const websocketErrorSchema = createWebsocketResponseSchema(
  websocketError,
  websocketErrorPayloadSchema,
);

export default slice.reducer;
