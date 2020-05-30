import { combineReducers } from 'redux';

import code from './code';
import configuration from './configuration';
import crates from './crates';
import globalConfiguration from './globalConfiguration';
import notifications from './notifications';
import output from './output';
import page from './page';
import position from './position';
import selection from './selection';
import versions from './versions';

const playgroundApp = combineReducers({
  code,
  configuration,
  crates,
  globalConfiguration,
  notifications,
  output,
  page,
  position,
  selection,
  versions,
});

export type State = ReturnType<typeof playgroundApp>;

export default playgroundApp;
