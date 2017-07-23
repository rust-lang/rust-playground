import { combineReducers } from 'redux';

import configuration from './configuration';
import code from './code';
import position from './position';
import output from './output';
import page from './page';

const playgroundApp = combineReducers({
  configuration,
  code,
  position,
  output,
  page,
});

export default playgroundApp;
