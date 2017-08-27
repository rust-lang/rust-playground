import { combineReducers } from 'redux';

import configuration, { State as ConfigurationState } from './configuration';
import code from './code';
import crates from './crates';
import position from './position';
import output from './output';
import page from './page';

export interface State {
  configuration: ConfigurationState,
  output: {
    meta: {
      focus?: boolean,
    },
  },
}

const playgroundApp = combineReducers({
  configuration,
  code,
  crates,
  position,
  output,
  page,
});

export default playgroundApp;
