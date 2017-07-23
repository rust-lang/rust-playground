import { combineReducers } from 'redux';

import configuration from './configuration';
import code from './code';
import crates from './crates';
import position from './position';
import output from './output';
import page from './page';

const playgroundApp = combineReducers({
  configuration,
  code,
  crates,
  position,
  output,
  page,
});

export default playgroundApp;
