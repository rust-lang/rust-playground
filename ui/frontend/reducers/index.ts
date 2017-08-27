import { combineReducers } from 'redux';

import configuration, { State as ConfigurationState } from './configuration';
import code, { State as CodeState } from './code';
import crates, { State as CratesState } from './crates';
import position, { State as PositionState } from './position';
import output, { State as OutputState } from './output';
import page, { State as PageState } from './page';

export interface State {
  configuration: ConfigurationState,
  code: CodeState,
  crates: CratesState,
  position: PositionState,
  output: OutputState,
  page: PageState,
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
