import { combineReducers } from 'redux';

import code, { State as CodeState } from './code';
import configuration, { State as ConfigurationState } from './configuration';
import crates, { State as CratesState } from './crates';
import globalConfiguration, { State as GlobalConfigurationState } from './globalConfiguration';
import output, { State as OutputState } from './output';
import page, { State as PageState } from './page';
import position, { State as PositionState } from './position';
import versions, { State as VersionsState } from './versions';

export interface State {
  code: CodeState;
  configuration: ConfigurationState;
  crates: CratesState;
  globalConfiguration: GlobalConfigurationState;
  output: OutputState;
  page: PageState;
  position: PositionState;
  versions: VersionsState;
}

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

export default playgroundApp;
