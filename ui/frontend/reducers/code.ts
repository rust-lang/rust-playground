import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { performFormat } from './output/format';
import { performGistLoad } from './output/gist';

const HELLO_WORLD: string = `fn main() {
    println!("Hello, world!");
}`;

const doAddCrateType = (code: string, crate_type: string): string =>
  `#![crate_type = "${crate_type}"]\n${code}`;

const slice = createSlice({
  name: 'code',
  initialState: HELLO_WORLD,
  reducers: {
    editCode: (_state, action: PayloadAction<string>) => action.payload,

    addMainFunction: (state) => `${state}\n\n${HELLO_WORLD}`,

    addImport: (state, action: PayloadAction<string>) => action.payload + state,

    addCrateType: (state, action: PayloadAction<string>) => doAddCrateType(state, action.payload),

    enableFeatureGate: (state, action: PayloadAction<string>) =>
      `#![feature(${action.payload})]\n${state}`,
  },
  extraReducers: (builder) => {
    builder
      .addCase(performGistLoad.pending, () => '')
      .addCase(performGistLoad.fulfilled, (_state, action) => action.payload.code)
      .addCase(performFormat.fulfilled, (_state, action) => action.payload.code);
  },
});

export const { editCode, addMainFunction, addImport, addCrateType, enableFeatureGate } =
  slice.actions;

export default slice.reducer;
