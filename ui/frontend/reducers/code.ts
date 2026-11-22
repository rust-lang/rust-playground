import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { performFormat } from './output/format';
import { performGistLoad } from './output/gist';

export const HELLO_WORLD: string = `fn main() {
    println!("Hello, world!");
}`;

export const doAddCrateType = (code: string, crate_type: string): string =>
  `#![crate_type = "${crate_type}"]\n${code}`;

const INNER_ATTRIBUTE_START = /^\s*#!\[/;
const INNER_DOC_COMMENT = /^\s*\/\/!/;
const BLANK_OR_LINE_COMMENT = /^\s*(\/\/.*)?\s*$/;

const bracketDelta = (line: string): number => {
  let delta = 0;
  for (const c of line) {
    if (c === '[') {
      delta += 1;
    } else if (c === ']') {
      delta -= 1;
    }
  }
  return delta;
};

// Inner attributes (e.g. `#![no_std]`, `#![feature(...)]`) and inner
// doc comments (`//!`) must come before any items, so imports need to
// be inserted after them. Returns the offset just past the last such
// line, which may be one past the end of the code if it lacks a
// trailing newline.
const findImportInsertionPoint = (code: string): number => {
  let offset = 0;
  let insertAt = 0;
  let depth = 0;

  for (const line of code.split('\n')) {
    const next = offset + line.length + 1;

    if (depth > 0) {
      depth += bracketDelta(line);
      if (depth <= 0) {
        depth = 0;
        insertAt = next;
      }
    } else if (INNER_ATTRIBUTE_START.test(line)) {
      depth = bracketDelta(line);
      if (depth <= 0) {
        depth = 0;
        insertAt = next;
      }
    } else if (INNER_DOC_COMMENT.test(line)) {
      insertAt = next;
    } else if (!BLANK_OR_LINE_COMMENT.test(line)) {
      break;
    }

    offset = next;
  }

  return insertAt;
};

export const doAddImport = (code: string, importText: string): string => {
  const insertAt = findImportInsertionPoint(code);
  if (insertAt > code.length) {
    return `${code}\n${importText}`;
  }
  return code.slice(0, insertAt) + importText + code.slice(insertAt);
};

const slice = createSlice({
  name: 'code',
  initialState: HELLO_WORLD,
  reducers: {
    editSingleCode: (_state, action: PayloadAction<string>) => action.payload,

    addMainFunction: (state) => `${state}\n\n${HELLO_WORLD}`,

    addImport: (state, action: PayloadAction<string>) => doAddImport(state, action.payload),

    addCrateType: (state, action: PayloadAction<string>) => doAddCrateType(state, action.payload),

    enableFeatureGate: (state, action: PayloadAction<string>) =>
      `#![feature(${action.payload})]\n${state}`,
  },
  extraReducers: (builder) => {
    builder
      .addCase(performGistLoad.pending, () => '')
      .addCase(performGistLoad.fulfilled, (state, action) => {
        if (typeof action.payload.code === 'string') {
          return action.payload.code;
        } else {
          return state;
        }
      })
      .addCase(performFormat.fulfilled, (state, action) => {
        if (typeof action.payload.code === 'string') {
          return action.payload.code;
        } else {
          return state;
        }
      });
  },
});

export const { editSingleCode, addMainFunction, addImport, addCrateType, enableFeatureGate } =
  slice.actions;

export default slice.reducer;
