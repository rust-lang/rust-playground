import { combineReducers } from 'redux';

import meta from './meta';
import format from './format';
import clippy from './clippy';
import assembly from './assembly';
import llvmIr from './llvmIr';
import mir from './mir';
import execute from './execute';
import gist from './gist';

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
