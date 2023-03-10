import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import z from 'zod';

import { createWebsocketResponseSchema } from '../websocketActions';

export type State = {
  connected: boolean;
  error?: string;
  featureFlagEnabled: boolean;
};

const initialState: State = {
  connected: false,
  featureFlagEnabled: false,
};

const websocketErrorPayloadSchema = z.object({
  error: z.string(),
});
type websocketErrorPayload = z.infer<typeof websocketErrorPayloadSchema>;

const slice = createSlice({
  name: 'websocket',
  initialState,
  reducers: {
    connected: (state) => {
      state.connected = true;
      delete state.error;
    },

    disconnected: (state) => {
      state.connected = false;
    },

    error: (state, action: PayloadAction<websocketErrorPayload>) => {
      state.error = action.payload.error;
    },

    featureFlagEnabled: (state) => {
      state.featureFlagEnabled = true;
    },
  },
});

export const {
  connected: websocketConnected,
  disconnected: websocketDisconnected,
  error: websocketError,
  featureFlagEnabled: websocketFeatureFlagEnabled,
} = slice.actions;

export const websocketErrorSchema = createWebsocketResponseSchema(
  websocketError,
  websocketErrorPayloadSchema,
);

export default slice.reducer;
