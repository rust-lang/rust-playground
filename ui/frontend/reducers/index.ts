import { combineReducers } from 'redux';

import code, { State as CodeState } from './code';
import compilerFlags, { State as CompilerFlagsState } from './compilerFlags';
import configuration, { State as ConfigurationState } from './configuration';
import crates, { State as CratesState } from './crates';
import output, { State as OutputState } from './output';
import page, { State as PageState } from './page';
import position, { State as PositionState } from './position';
import versions, { State as VersionsState } from './versions';

export interface State {
  compilerFlags: CompilerFlagsState;
  configuration: ConfigurationState;
  code: CodeState;
  crates: CratesState;
  position: PositionState;
  output: OutputState;
  page: PageState;
  versions: VersionsState;
}

const playgroundApp = combineReducers({
  compilerFlags,
  configuration,
  code,
  crates,
  position,
  output,
  page,
  versions,
});

export default playgroundApp;
