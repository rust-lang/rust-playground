import { combineReducers } from 'redux';

import meta, { State as MetaState } from './meta';
import format, { State as FormatState } from './format';
import clippy, { State as ClippyState } from './clippy';
import assembly, { State as AssemblyState } from './assembly';
import llvmIr, { State as LlvmIrState } from './llvmIr';
import mir, { State as MirState } from './mir';
import execute, { State as ExecuteState } from './execute';
import gist, { State as GistState } from './gist';

export interface State {
  meta: MetaState,
  format: FormatState,
  clippy: ClippyState,
  assembly: AssemblyState,
  llvmIr: LlvmIrState,
  mir: MirState,
  execute: ExecuteState,
  gist: GistState,
};

const output = combineReducers({
  meta,
  format,
  clippy,
  assembly,
  llvmIr,
  mir,
  execute,
  gist,
});

export default output;
