import { combineReducers } from 'redux';

import assembly, { State as AssemblyState } from './assembly';
import clippy, { State as ClippyState } from './clippy';
import execute, { State as ExecuteState } from './execute';
import format, { State as FormatState } from './format';
import gist, { State as GistState } from './gist';
import llvmIr, { State as LlvmIrState } from './llvmIr';
import meta, { State as MetaState } from './meta';
import mir, { State as MirState } from './mir';
import wasm, { State as WasmState } from './wasm';

export interface State {
  meta: MetaState;
  format: FormatState;
  clippy: ClippyState;
  assembly: AssemblyState;
  llvmIr: LlvmIrState;
  mir: MirState;
  wasm: WasmState;
  execute: ExecuteState;
  gist: GistState;
}

const output = combineReducers({
  meta,
  format,
  clippy,
  assembly,
  llvmIr,
  mir,
  wasm,
  execute,
  gist,
});

export default output;
