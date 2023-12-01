import { ThunkAction as ReduxThunkAction, AnyAction } from '@reduxjs/toolkit';

import {
  getCrateType,
  runAsTest,
  wasmLikelyToWork,
} from './selectors';
import State from './state';
import {
  AssemblyFlavor,
  Backtrace,
  Channel,
  DemangleAssembly,
  Edition,
  Editor,
  Mode,
  Orientation,
  PairCharacters,
  PrimaryAction,
  PrimaryActionAuto,
  PrimaryActionCore,
  ProcessAssembly,
  Position,
} from './types';

import { performCommonExecute, wsExecuteRequest } from './reducers/output/execute';
import { performGistLoad } from './reducers/output/gist';
import { performCompileToAssemblyOnly } from './reducers/output/assembly';
import { performCompileToHirOnly } from './reducers/output/hir';
import { performCompileToLlvmIrOnly } from './reducers/output/llvmIr';
import { performCompileToMirOnly } from './reducers/output/mir';
import { performCompileToWasmOnly } from './reducers/output/wasm';
import { navigateToHelp, navigateToIndex } from './reducers/page';
import { addCrateType, editCode } from './reducers/code';

export type ThunkAction<T = void> = ReduxThunkAction<T, State, {}, Action>;
export type SimpleThunkAction<T = void> = ReduxThunkAction<T, State, {}, AnyAction>;

const createAction = <T extends string, P extends {}>(type: T, props?: P) => (
  Object.assign({ type }, props)
);

export enum ActionType {
  InitializeApplication = 'INITIALIZE_APPLICATION',
  ChangeEditor = 'CHANGE_EDITOR',
  ChangeKeybinding = 'CHANGE_KEYBINDING',
  ChangeAceTheme = 'CHANGE_ACE_THEME',
  ChangeMonacoTheme = 'CHANGE_MONACO_THEME',
  ChangePairCharacters = 'CHANGE_PAIR_CHARACTERS',
  ChangeOrientation = 'CHANGE_ORIENTATION',
  ChangeAssemblyFlavor = 'CHANGE_ASSEMBLY_FLAVOR',
  ChangePrimaryAction = 'CHANGE_PRIMARY_ACTION',
  ChangeChannel = 'CHANGE_CHANNEL',
  ChangeDemangleAssembly = 'CHANGE_DEMANGLE_ASSEMBLY',
  ChangeProcessAssembly = 'CHANGE_PROCESS_ASSEMBLY',
  ChangeMode = 'CHANGE_MODE',
  ChangeEdition = 'CHANGE_EDITION',
  ChangeBacktrace = 'CHANGE_BACKTRACE',
  SelectText = 'SELECT_TEXT',
}

export const initializeApplication = () => createAction(ActionType.InitializeApplication);

export const changeEditor = (editor: Editor) =>
  createAction(ActionType.ChangeEditor, { editor });

export const changeKeybinding = (keybinding: string) =>
  createAction(ActionType.ChangeKeybinding, { keybinding });

export const changeAceTheme = (theme: string) =>
  createAction(ActionType.ChangeAceTheme, { theme });

export const changeMonacoTheme = (theme: string) =>
  createAction(ActionType.ChangeMonacoTheme, { theme });

export const changePairCharacters = (pairCharacters: PairCharacters) =>
  createAction(ActionType.ChangePairCharacters, { pairCharacters });

export const changeOrientation = (orientation: Orientation) =>
  createAction(ActionType.ChangeOrientation, { orientation });

export const changeAssemblyFlavor = (assemblyFlavor: AssemblyFlavor) =>
  createAction(ActionType.ChangeAssemblyFlavor, { assemblyFlavor });

export const changeDemangleAssembly = (demangleAssembly: DemangleAssembly) =>
  createAction(ActionType.ChangeDemangleAssembly, { demangleAssembly });

export const changeProcessAssembly = (processAssembly: ProcessAssembly) =>
  createAction(ActionType.ChangeProcessAssembly, { processAssembly });

const changePrimaryAction = (primaryAction: PrimaryAction) =>
  createAction(ActionType.ChangePrimaryAction, { primaryAction });

export const changeChannel = (channel: Channel) =>
  createAction(ActionType.ChangeChannel, { channel });

export const changeMode = (mode: Mode) =>
  createAction(ActionType.ChangeMode, { mode });

const changeEditionRaw = (edition: Edition) =>
  createAction(ActionType.ChangeEdition, { edition });

export const changeEdition = (edition: Edition): ThunkAction => dispatch => {
  if (edition === Edition.Rust2024) {
    dispatch(changeChannel(Channel.Nightly));
  }

  dispatch(changeEditionRaw(edition));
}

export const changeBacktrace = (backtrace: Backtrace) =>
  createAction(ActionType.ChangeBacktrace, { backtrace });

export const reExecuteWithBacktrace = (): ThunkAction => dispatch => {
  dispatch(changeBacktrace(Backtrace.Enabled));
  dispatch(performExecuteOnly());
};


function performAutoOnly(): ThunkAction {
  return function(dispatch, getState) {
    const state = getState();
    const crateType = getCrateType(state);
    const tests = runAsTest(state);

    return dispatch(performCommonExecute(crateType, tests));
  };
}

const performExecuteOnly = (): ThunkAction => performCommonExecute('bin', false);
const performCompileOnly = (): ThunkAction => performCommonExecute('lib', false);
const performTestOnly = (): ThunkAction => (dispatch, getState) => {
  const state = getState();
  const crateType = getCrateType(state);
  return dispatch(performCommonExecute(crateType, true));
};

const performCompileToNightlyHirOnly = (): ThunkAction => dispatch => {
  dispatch(changeChannel(Channel.Nightly));
  dispatch(performCompileToHirOnly());
};

const performCompileToCdylibWasmOnly = (): ThunkAction => (dispatch, getState) => {
  const state = getState();

  if (!wasmLikelyToWork(state)) {
    dispatch(addCrateType('cdylib'));
  }
  dispatch(performCompileToWasmOnly());
};

const PRIMARY_ACTIONS: { [index in PrimaryAction]: () => ThunkAction } = {
  [PrimaryActionCore.Asm]: performCompileToAssemblyOnly,
  [PrimaryActionCore.Compile]: performCompileOnly,
  [PrimaryActionCore.Execute]: performExecuteOnly,
  [PrimaryActionCore.Test]: performTestOnly,
  [PrimaryActionAuto.Auto]: performAutoOnly,
  [PrimaryActionCore.LlvmIr]: performCompileToLlvmIrOnly,
  [PrimaryActionCore.Hir]: performCompileToHirOnly,
  [PrimaryActionCore.Mir]: performCompileToMirOnly,
  [PrimaryActionCore.Wasm]: performCompileToWasmOnly,
};

export const performPrimaryAction = (): ThunkAction => (dispatch, getState) => {
  const state = getState();
  const primaryAction = PRIMARY_ACTIONS[state.configuration.primaryAction];
  dispatch(primaryAction());
};

const performAndSwitchPrimaryAction = (inner: () => ThunkAction, id: PrimaryAction) => (): ThunkAction => dispatch => {
  dispatch(changePrimaryAction(id));
  dispatch(inner());
};

export const performExecute =
  performAndSwitchPrimaryAction(performExecuteOnly, PrimaryActionCore.Execute);
export const performCompile =
  performAndSwitchPrimaryAction(performCompileOnly, PrimaryActionCore.Compile);
export const performTest =
  performAndSwitchPrimaryAction(performTestOnly, PrimaryActionCore.Test);
export const performCompileToAssembly =
  performAndSwitchPrimaryAction(performCompileToAssemblyOnly, PrimaryActionCore.Asm);
export const performCompileToLLVM =
  performAndSwitchPrimaryAction(performCompileToLlvmIrOnly, PrimaryActionCore.LlvmIr);
export const performCompileToMir =
  performAndSwitchPrimaryAction(performCompileToMirOnly, PrimaryActionCore.Mir);
export const performCompileToNightlyHir =
  performAndSwitchPrimaryAction(performCompileToNightlyHirOnly, PrimaryActionCore.Hir);
export const performCompileToWasm =
  performAndSwitchPrimaryAction(performCompileToCdylibWasmOnly, PrimaryActionCore.Wasm);

export const selectText = (start: Position, end: Position) =>
  createAction(ActionType.SelectText, { start, end });

function parseChannel(s?: string): Channel | null {
  switch (s) {
    case 'stable':
      return Channel.Stable;
    case 'beta':
      return Channel.Beta;
    case 'nightly':
      return Channel.Nightly;
    default:
      return null;
  }
}

function parseMode(s?: string): Mode | null {
  switch (s) {
    case 'debug':
      return Mode.Debug;
    case 'release':
      return Mode.Release;
    default:
      return null;
  }
}

function parseEdition(s?: string): Edition | null {
  switch (s) {
    case '2015':
      return Edition.Rust2015;
    case '2018':
      return Edition.Rust2018;
    case '2021':
      return Edition.Rust2021;
    case '2024':
      return Edition.Rust2024;
    default:
      return null;
  }
}

export function indexPageLoad({
  code,
  gist,
  version,
  mode: modeString,
  edition: editionString,
}: { code?: string, gist?: string, version?: string, mode?: string, edition?: string }): ThunkAction {
  return function(dispatch) {
    const channel = parseChannel(version) || Channel.Stable;
    const mode = parseMode(modeString) || Mode.Debug;
    let maybeEdition = parseEdition(editionString);

    dispatch(navigateToIndex());

    if (code || gist) {
      // We need to ensure that any links that predate the existence
      // of editions will *forever* pick 2015. However, if we aren't
      // loading code, then allow the edition to remain the default.
      if (!maybeEdition) {
        maybeEdition = Edition.Rust2015;
      }
    }

    const edition = maybeEdition || Edition.Rust2021;

    if (code) {
      dispatch(editCode(code));
    } else if (gist) {
      dispatch(performGistLoad({ id: gist, channel, mode, edition }));
    }

    dispatch(changeChannel(channel));
    dispatch(changeMode(mode));
    dispatch(changeEditionRaw(edition));
  };
}

export const helpPageLoad = navigateToHelp;

export function showExample(code: string): ThunkAction {
  return function(dispatch) {
    dispatch(navigateToIndex());
    dispatch(editCode(code));
  };
}

export type Action =
  | ReturnType<typeof initializeApplication>
  | ReturnType<typeof changePairCharacters>
  | ReturnType<typeof changeAssemblyFlavor>
  | ReturnType<typeof changeBacktrace>
  | ReturnType<typeof changeChannel>
  | ReturnType<typeof changeDemangleAssembly>
  | ReturnType<typeof changeEditionRaw>
  | ReturnType<typeof changeEditor>
  | ReturnType<typeof changeKeybinding>
  | ReturnType<typeof changeMode>
  | ReturnType<typeof changeOrientation>
  | ReturnType<typeof changePrimaryAction>
  | ReturnType<typeof changeProcessAssembly>
  | ReturnType<typeof changeAceTheme>
  | ReturnType<typeof changeMonacoTheme>
  | ReturnType<typeof selectText>
  | ReturnType<typeof editCode>
  | ReturnType<typeof addCrateType>
  | ReturnType<typeof navigateToIndex>
  | ReturnType<typeof wsExecuteRequest>
  ;
