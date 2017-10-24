import { combineReducers } from 'redux';

import code, { State as CodeState } from './code';
import configuration, { State as ConfigurationState } from './configuration';
import crates, { State as CratesState } from './crates';
import output, { State as OutputState } from './output';
import page, { State as PageState } from './page';
import position, { State as PositionState } from './position';
import versions, { State as VersionsState } from './versions';

export interface State {
  configuration: ConfigurationState;
  code: CodeState;
  crates: CratesState;
  position: PositionState;
  output: OutputState;
  page: PageState;
  versions: VersionsState;
}

const playgroundApp = combineReducers({
  configuration,
  code,
  crates,
  position,
  output,
  page,
  versions,
});

export default playgroundApp;
