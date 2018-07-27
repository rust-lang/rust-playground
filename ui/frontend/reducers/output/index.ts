import { combineReducers } from 'redux';

import assembly from './assembly';
import clippy from './clippy';
import execute from './execute';
import format from './format';
import gist from './gist';
import llvmIr from './llvmIr';
import meta from './meta';
import mir from './mir';
import miri from './miri';
import wasm from './wasm';

const output = combineReducers({
  meta,
  format,
  clippy,
  miri,
  assembly,
  llvmIr,
  mir,
  wasm,
  execute,
  gist,
});

export type State = ReturnType<typeof output>;

export default output;
