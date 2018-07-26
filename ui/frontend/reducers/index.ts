import { combineReducers } from 'redux';

import code from './code';
import configuration from './configuration';
import crates from './crates';
import globalConfiguration from './globalConfiguration';
import output from './output';
import page from './page';
import position from './position';
import versions from './versions';

const playgroundApp = combineReducers({
  code,
  configuration,
  crates,
  globalConfiguration,
  output,
  page,
  position,
  versions,
});

export type State = ReturnType<typeof playgroundApp>;

export default playgroundApp;
