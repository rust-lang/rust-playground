import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import * as z from 'zod';

const StateOverride = z.object({
  baseUrl: z.string().optional(),
  syncChangesToStorage: z.boolean().optional(),
  excessiveExecutionTimeS: z.number().optional(),
  killGracePeriodS: z.number().optional(),
});
type StateOverride = z.infer<typeof StateOverride>;

type State = Required<StateOverride>;

const initialState: State = {
  baseUrl: '',
  syncChangesToStorage: true,
  excessiveExecutionTimeS: 15.0,
  killGracePeriodS: 15.0,
};

const slice = createSlice({
  name: 'globalConfiguration',
  initialState,
  reducers: {
    disableSyncChangesToStorage: (state) => {
      state.syncChangesToStorage = false;
    },

    override: (state, action: PayloadAction<string>) => {
      try {
        const object = JSON.parse(action.payload);
        const parsed = StateOverride.parse(object);
        Object.assign(state, parsed);
      } catch {
        // Do nothing
      }
    },
  },
});

export const { disableSyncChangesToStorage, override } = slice.actions;

export default slice.reducer;
