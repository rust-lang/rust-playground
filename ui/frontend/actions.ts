import fetch from 'isomorphic-fetch';
import { ThunkAction as ReduxThunkAction } from 'redux-thunk';
import url from 'url';

import { clippyRequestSelector, getCrateType, isAutoBuildSelector, runAsTest } from './selectors';
import State from './state';
import {
  AssemblyFlavor,
  Backtrace,
  Channel,
  DemangleAssembly,
  Edition,
  Editor,
  Focus,
  Mode,
  Notification,
  Orientation,
  Page,
  PrimaryAction,
  PrimaryActionAuto,
  PrimaryActionCore,
  ProcessAssembly,
} from './types';

const routes = {
  compile: { pathname: '/compile' },
  execute: { pathname: '/execute' },
  format: { pathname: '/format' },
  clippy: { pathname: '/clippy' },
  miri: { pathname: '/miri' },
  meta: {
    crates: { pathname: '/meta/crates' },
    version: {
      stable: '/meta/version/stable',
      beta: '/meta/version/beta',
      nightly: '/meta/version/nightly',
      rustfmt: '/meta/version/rustfmt',
      clippy: '/meta/version/clippy',
      miri: '/meta/version/miri',
    },
    gist: { pathname: '/meta/gist/' },
  },
};

type ThunkAction<T = void> = ReduxThunkAction<T, State, {}, Action>;

const createAction = <T extends string, P extends {}>(type: T, props?: P) => (
  Object.assign({ type }, props)
);

export enum ActionType {
  ToggleConfiguration = 'TOGGLE_CONFIGURATION',
  SetPage = 'SET_PAGE',
  ChangeEditor = 'CHANGE_EDITOR',
  ChangeKeybinding = 'CHANGE_KEYBINDING',
  ChangeTheme = 'CHANGE_THEME',
  ChangeOrientation = 'CHANGE_ORIENTATION',
  ChangeAssemblyFlavor = 'CHANGE_ASSEMBLY_FLAVOR',
  ChangePrimaryAction = 'CHANGE_PRIMARY_ACTION',
  ChangeChannel = 'CHANGE_CHANNEL',
  ChangeDemangleAssembly = 'CHANGE_DEMANGLE_ASSEMBLY',
  ChangeProcessAssembly = 'CHANGE_PROCESS_ASSEMBLY',
  ChangeMode = 'CHANGE_MODE',
  ChangeEdition = 'CHANGE_EDITION',
  ChangeBacktrace = 'CHANGE_BACKTRACE',
  ChangeFocus = 'CHANGE_FOCUS',
  ExecuteRequest = 'EXECUTE_REQUEST',
  ExecuteSucceeded = 'EXECUTE_SUCCEEDED',
  ExecuteFailed = 'EXECUTE_FAILED',
  CompileAssemblyRequest = 'COMPILE_ASSEMBLY_REQUEST',
  CompileAssemblySucceeded = 'COMPILE_ASSEMBLY_SUCCEEDED',
  CompileAssemblyFailed = 'COMPILE_ASSEMBLY_FAILED',
  CompileLlvmIrRequest = 'COMPILE_LLVM_IR_REQUEST',
  CompileLlvmIrSucceeded = 'COMPILE_LLVM_IR_SUCCEEDED',
  CompileLlvmIrFailed = 'COMPILE_LLVM_IR_FAILED',
  CompileMirRequest = 'COMPILE_MIR_REQUEST',
  CompileMirSucceeded = 'COMPILE_MIR_SUCCEEDED',
  CompileMirFailed = 'COMPILE_MIR_FAILED',
  CompileWasmRequest = 'COMPILE_WASM_REQUEST',
  CompileWasmSucceeded = 'COMPILE_WASM_SUCCEEDED',
  CompileWasmFailed = 'COMPILE_WASM_FAILED',
  EditCode = 'EDIT_CODE',
  AddMainFunction = 'ADD_MAIN_FUNCTION',
  EnableFeatureGate = 'ENABLE_FEATURE_GATE',
  GotoPosition = 'GOTO_POSITION',
  RequestFormat = 'REQUEST_FORMAT',
  FormatSucceeded = 'FORMAT_SUCCEEDED',
  FormatFailed = 'FORMAT_FAILED',
  RequestClippy = 'REQUEST_CLIPPY',
  ClippySucceeded = 'CLIPPY_SUCCEEDED',
  ClippyFailed = 'CLIPPY_FAILED',
  RequestMiri = 'REQUEST_MIRI',
  MiriSucceeded = 'MIRI_SUCCEEDED',
  MiriFailed = 'MIRI_FAILED',
  RequestGistLoad = 'REQUEST_GIST_LOAD',
  GistLoadSucceeded = 'GIST_LOAD_SUCCEEDED',
  GistLoadFailed = 'GIST_LOAD_FAILED',
  RequestGistSave = 'REQUEST_GIST_SAVE',
  GistSaveSucceeded = 'GIST_SAVE_SUCCEEDED',
  GistSaveFailed = 'GIST_SAVE_FAILED',
  RequestCratesLoad = 'REQUEST_CRATES_LOAD',
  CratesLoadSucceeded = 'CRATES_LOAD_SUCCEEDED',
  RequestVersionsLoad = 'REQUEST_VERSIONS_LOAD',
  VersionsLoadSucceeded = 'VERSIONS_LOAD_SUCCEEDED',
  NotificationSeen = 'NOTIFICATION_SEEN',
}

export const toggleConfiguration = () =>
  createAction(ActionType.ToggleConfiguration);

const setPage = (page: Page) =>
  createAction(ActionType.SetPage, { page });

export const navigateToIndex = () => setPage('index');
export const navigateToHelp = () => setPage('help');

export const changeEditor = (editor: Editor) =>
  createAction(ActionType.ChangeEditor, { editor });

export const changeKeybinding = (keybinding: string) =>
  createAction(ActionType.ChangeKeybinding, { keybinding });

export const changeTheme = (theme: string) =>
  createAction(ActionType.ChangeTheme, { theme });

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

export const changeEdition = (edition: Edition) =>
  createAction(ActionType.ChangeEdition, { edition });

export const changeBacktrace = (backtrace: Backtrace) =>
  createAction(ActionType.ChangeBacktrace, { backtrace });

export const reExecuteWithBacktrace = (): ThunkAction => dispatch => {
  dispatch(changeBacktrace(Backtrace.Enabled));
  dispatch(performExecuteOnly());
};

export const changeFocus = (focus: Focus) =>
  createAction(ActionType.ChangeFocus, { focus });

const requestExecute = () =>
  createAction(ActionType.ExecuteRequest);

const receiveExecuteSuccess = ({ stdout, stderr, isAutoBuild }) =>
  createAction(ActionType.ExecuteSucceeded, { stdout, stderr, isAutoBuild });

const receiveExecuteFailure = ({ error, isAutoBuild }) =>
  createAction(ActionType.ExecuteFailed, { error, isAutoBuild });

function jsonGet(urlObj) {
  const urlStr = url.format(urlObj);

  return fetchJson(urlStr, {
    method: 'get',
  });
}

function jsonPost(urlObj, body) {
  const urlStr = url.format(urlObj);

  return fetchJson(urlStr, {
    method: 'post',
    body: JSON.stringify(body),
  });
}

async function fetchJson(url, args) {
  const { headers = {} } = args;
  headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, { ...args, headers });
  } catch (networkError) {
    // e.g. server unreachable
    throw ({
      error: `Network error: ${networkError.toString()}`,
    });
  }

  let body;
  try {
    body = await response.json();
  } catch (convertError) {
    throw ({
      error: `Response was not JSON: ${convertError.toString()}`,
    });
  }

  if (response.ok) {
    // HTTP 2xx
    return body;
  } else {
    // HTTP 4xx, 5xx (e.g. malformed JSON request)
    throw body;
  }
}

interface ExecuteRequestBody {
  channel: string;
  mode: string;
  crateType: string;
  tests: boolean;
  code: string;
  edition: string;
  backtrace: boolean;
}

const performCommonExecute = (crateType, tests): ThunkAction => (dispatch, getState) => {
  dispatch(requestExecute());

  const state = getState();
  const { code, configuration: { channel, mode, edition } } = state;
  const backtrace = state.configuration.backtrace === Backtrace.Enabled;
  const isAutoBuild = isAutoBuildSelector(state);

  const body: ExecuteRequestBody = { channel, mode, edition, crateType, tests, code, backtrace };

  return jsonPost(routes.execute, body)
    .then(json => dispatch(receiveExecuteSuccess({ ...json, isAutoBuild })))
    .catch(json => dispatch(receiveExecuteFailure({ ...json, isAutoBuild })));
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
const performTestOnly = (): ThunkAction => performCommonExecute('lib', true);

interface CompileRequestBody extends ExecuteRequestBody {
  target: string;
  assemblyFlavor: string;
  demangleAssembly: string;
  processAssembly: string;
}

function performCompileShow(target, { request, success, failure }): ThunkAction {
  // TODO: Check a cache
  return function(dispatch, getState) {
    dispatch(request());

    const state = getState();
    const { code, configuration: {
      channel,
      mode,
      edition,
      assemblyFlavor,
      demangleAssembly,
      processAssembly,
    } } = state;
    const crateType = getCrateType(state);
    const tests = runAsTest(state);
    const backtrace = state.configuration.backtrace === Backtrace.Enabled;
    const body: CompileRequestBody = {
      channel,
      mode,
      edition,
      crateType,
      tests,
      code,
      target,
      assemblyFlavor,
      demangleAssembly,
      processAssembly,
      backtrace,
    };

    return jsonPost(routes.compile, body)
      .then(json => dispatch(success(json)))
      .catch(json => dispatch(failure(json)));
  };
}

const requestCompileAssembly = () =>
  createAction(ActionType.CompileAssemblyRequest);

const receiveCompileAssemblySuccess = ({ code, stdout, stderr }) =>
  createAction(ActionType.CompileAssemblySucceeded, { code, stdout, stderr });

const receiveCompileAssemblyFailure = ({ error }) =>
  createAction(ActionType.CompileAssemblyFailed, { error });

const performCompileToAssemblyOnly = () =>
  performCompileShow('asm', {
    request: requestCompileAssembly,
    success: receiveCompileAssemblySuccess,
    failure: receiveCompileAssemblyFailure,
  });

const requestCompileLlvmIr = () =>
  createAction(ActionType.CompileLlvmIrRequest);

const receiveCompileLlvmIrSuccess = ({ code, stdout, stderr }) =>
  createAction(ActionType.CompileLlvmIrSucceeded, { code, stdout, stderr });

const receiveCompileLlvmIrFailure = ({ error }) =>
  createAction(ActionType.CompileLlvmIrFailed, { error });

const performCompileToLLVMOnly = () =>
  performCompileShow('llvm-ir', {
    request: requestCompileLlvmIr,
    success: receiveCompileLlvmIrSuccess,
    failure: receiveCompileLlvmIrFailure,
  });

const requestCompileMir = () =>
  createAction(ActionType.CompileMirRequest);

const receiveCompileMirSuccess = ({ code, stdout, stderr }) =>
  createAction(ActionType.CompileMirSucceeded, { code, stdout, stderr });

const receiveCompileMirFailure = ({ error }) =>
  createAction(ActionType.CompileMirFailed, { error });

const performCompileToMirOnly = () =>
  performCompileShow('mir', {
    request: requestCompileMir,
    success: receiveCompileMirSuccess,
    failure: receiveCompileMirFailure,
  });

const requestCompileWasm = () =>
  createAction(ActionType.CompileWasmRequest);

const receiveCompileWasmSuccess = ({ code, stdout, stderr }) =>
  createAction(ActionType.CompileWasmSucceeded, { code, stdout, stderr });

const receiveCompileWasmFailure = ({ error }) =>
  createAction(ActionType.CompileWasmFailed, { error });

const performCompileToWasm = () =>
  performCompileShow('wasm', {
    request: requestCompileWasm,
    success: receiveCompileWasmSuccess,
    failure: receiveCompileWasmFailure,
  });

const performCompileToNightlyWasmOnly = (): ThunkAction => dispatch => {
  dispatch(changeChannel(Channel.Nightly));
  dispatch(performCompileToWasm());
};

const PRIMARY_ACTIONS: { [index in PrimaryAction]: () => ThunkAction } = {
  [PrimaryActionCore.Asm]: performCompileToAssemblyOnly,
  [PrimaryActionCore.Compile]: performCompileOnly,
  [PrimaryActionCore.Execute]: performExecuteOnly,
  [PrimaryActionCore.Test]: performTestOnly,
  [PrimaryActionAuto.Auto]: performAutoOnly,
  [PrimaryActionCore.LlvmIr]: performCompileToLLVMOnly,
  [PrimaryActionCore.Mir]: performCompileToMirOnly,
  [PrimaryActionCore.Wasm]: performCompileToNightlyWasmOnly,
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
  performAndSwitchPrimaryAction(performCompileToLLVMOnly, PrimaryActionCore.LlvmIr);
export const performCompileToMir =
  performAndSwitchPrimaryAction(performCompileToMirOnly, PrimaryActionCore.Mir);
export const performCompileToNightlyWasm =
  performAndSwitchPrimaryAction(performCompileToNightlyWasmOnly, PrimaryActionCore.Wasm);

export const editCode = (code: string) =>
  createAction(ActionType.EditCode, { code });

export const addMainFunction = () =>
  createAction(ActionType.AddMainFunction);

export const enableFeatureGate = (featureGate: string) =>
  createAction(ActionType.EnableFeatureGate, { featureGate });

export const gotoPosition = (line, column) =>
  createAction(ActionType.GotoPosition, { line: +line, column: +column });

const requestFormat = () =>
  createAction(ActionType.RequestFormat);

interface FormatResponseBody {
  code: string;
  stdout: string;
  stderr: string;
  error: string;
}

const receiveFormatSuccess = (body: FormatResponseBody) =>
  createAction(ActionType.FormatSucceeded, body);

const receiveFormatFailure = (body: FormatResponseBody) =>
  createAction(ActionType.FormatFailed, body);

export function performFormat(): ThunkAction {
  // TODO: Check a cache
  return function(dispatch, getState) {
    dispatch(requestFormat());

    const { code } = getState();
    const body = { code };

    return jsonPost(routes.format, body)
      .then(json => {
        if (json.success) {
          dispatch(receiveFormatSuccess(json));
        } else {
          dispatch(receiveFormatFailure(json));
        }
      })
      .catch(json => dispatch(receiveFormatFailure(json)));
  };
}

const requestClippy = () =>
  createAction(ActionType.RequestClippy);

interface ClippyRequestBody {
  code: string;
  edition: string;
  crateType: string;
}

const receiveClippySuccess = ({ stdout, stderr }) =>
  createAction(ActionType.ClippySucceeded, { stdout, stderr });

const receiveClippyFailure = ({ error }) =>
  createAction(ActionType.ClippyFailed, { error });

export function performClippy(): ThunkAction {
  // TODO: Check a cache
  return function(dispatch, getState) {
    dispatch(requestClippy());

    const body: ClippyRequestBody = clippyRequestSelector(getState());

    return jsonPost(routes.clippy, body)
      .then(json => dispatch(receiveClippySuccess(json)))
      .catch(json => dispatch(receiveClippyFailure(json)));
  };
}

const requestMiri = () =>
  createAction(ActionType.RequestMiri);

interface MiriRequestBody {
  code: string;
  edition: string;
}

const receiveMiriSuccess = ({ stdout, stderr }) =>
  createAction(ActionType.MiriSucceeded, { stdout, stderr });

const receiveMiriFailure = ({ error }) =>
  createAction(ActionType.MiriFailed, { error });

export function performMiri(): ThunkAction {
  // TODO: Check a cache
  return function(dispatch, getState) {
    dispatch(requestMiri());

    const { code, configuration: {
      edition,
    } } = getState();
    const body: MiriRequestBody = { code, edition };

    return jsonPost(routes.miri, body)
      .then(json => dispatch(receiveMiriSuccess(json)))
      .catch(json => dispatch(receiveMiriFailure(json)));
  };
}

interface GistSuccessProps {
  id: string;
  url: string;
  code: string;
  stdout: string;
  stderr: string;
  channel: Channel;
  mode: Mode;
  edition: Edition;
}

const requestGistLoad = () =>
  createAction(ActionType.RequestGistLoad);

const receiveGistLoadSuccess = (props: GistSuccessProps) =>
  createAction(ActionType.GistLoadSucceeded, props);

const receiveGistLoadFailure = () => // eslint-disable-line no-unused-vars
  createAction(ActionType.GistLoadFailed);

type PerformGistLoadProps =
  Pick<GistSuccessProps, Exclude<keyof GistSuccessProps, 'url' | 'code' | 'stdout' | 'stderr'>>;

export function performGistLoad({ id, channel, mode, edition }: PerformGistLoadProps): ThunkAction {
  return function(dispatch, _getState) {
    dispatch(requestGistLoad());
    const u = url.resolve(routes.meta.gist.pathname, id);
    jsonGet(u)
      .then(gist => dispatch(receiveGistLoadSuccess({ channel, mode, edition, ...gist })));
    // TODO: Failure case
  };
}

const requestGistSave = () =>
  createAction(ActionType.RequestGistSave);

const receiveGistSaveSuccess = (props: GistSuccessProps) =>
  createAction(ActionType.GistSaveSucceeded, props);

const receiveGistSaveFailure = ({ error }) => // eslint-disable-line no-unused-vars
  createAction(ActionType.GistSaveFailed, { error });

export function performGistSave(): ThunkAction {
  return function(dispatch, getState) {
    dispatch(requestGistSave());

    const { code, configuration: { channel, mode, edition }, output: { execute: { stdout, stderr } } } = getState();

    return jsonPost(routes.meta.gist, { code })
      .then(json => dispatch(receiveGistSaveSuccess({ ...json, code, stdout, stderr, channel, mode, edition })));
    // TODO: Failure case
  };
}

const requestCratesLoad = () =>
  createAction(ActionType.RequestCratesLoad);

const receiveCratesLoadSuccess = ({ crates }) =>
  createAction(ActionType.CratesLoadSucceeded, { crates });

export function performCratesLoad(): ThunkAction {
  return function(dispatch) {
    dispatch(requestCratesLoad());

    return jsonGet(routes.meta.crates)
      .then(json => dispatch(receiveCratesLoadSuccess(json)));
    // TODO: Failure case
  };
}

const requestVersionsLoad = () =>
  createAction(ActionType.RequestVersionsLoad);

const receiveVersionsLoadSuccess = ({ stable, beta, nightly, rustfmt, clippy, miri }) =>
  createAction(ActionType.VersionsLoadSucceeded, { stable, beta, nightly, rustfmt, clippy, miri });

export function performVersionsLoad(): ThunkAction {
  return function(dispatch) {
    dispatch(requestVersionsLoad());

    const stable = jsonGet(routes.meta.version.stable);
    const beta = jsonGet(routes.meta.version.beta);
    const nightly = jsonGet(routes.meta.version.nightly);
    const rustfmt = jsonGet(routes.meta.version.rustfmt);
    const clippy = jsonGet(routes.meta.version.clippy);
    const miri = jsonGet(routes.meta.version.miri);

    const all = Promise.all([stable, beta, nightly, rustfmt, clippy, miri]);

    return all
      .then(([stable, beta, nightly, rustfmt, clippy, miri]) => dispatch(receiveVersionsLoadSuccess({
        stable,
        beta,
        nightly,
        rustfmt,
        clippy,
        miri,
      })));
    // TODO: Failure case
  };
}

const notificationSeen = (notification: Notification) =>
  createAction(ActionType.NotificationSeen, { notification });

export const seenRust2018IsDefault = () => notificationSeen(Notification.Rust2018IsDefault);

function parseChannel(s: string): Channel | null {
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

function parseMode(s: string): Mode | null {
  switch (s) {
    case 'debug':
      return Mode.Debug;
    case 'release':
      return Mode.Release;
    default:
      return null;
  }
}

function parseEdition(s: string): Edition | null {
  switch (s) {
    case '2015':
      return Edition.Rust2015;
    case '2018':
      return Edition.Rust2018;
    default:
      return null;
  }
}

export function indexPageLoad({
  code,
  gist,
  version = 'stable',
  mode: modeString = 'debug',
  edition: editionString,
}): ThunkAction {
  return function(dispatch) {
    const channel = parseChannel(version);
    const mode = parseMode(modeString);
    let edition = parseEdition(editionString);

    dispatch(navigateToIndex());

    if (code || gist) {
      // We need to ensure that any links that predate the existence
      // of editions will *forever* pick 2015. However, if we aren't
      // loading code, then allow the edition to remain the default.
      if (!edition) {
        edition = Edition.Rust2015;
      }
    }

    if (code) {
      dispatch(editCode(code));
    } else if (gist) {
      dispatch(performGistLoad({ id: gist, channel, mode, edition }));
    }

    if (channel) {
      dispatch(changeChannel(channel));
    }

    if (mode) {
      dispatch(changeMode(mode));
    }

    if (edition) {
      dispatch(changeEdition(edition));
    }
  };
}

export function helpPageLoad() {
  return navigateToHelp();
}

export function showExample(code): ThunkAction {
  return function(dispatch) {
    dispatch(navigateToIndex());
    dispatch(editCode(code));
  };
}

export type Action =
  | ReturnType<typeof toggleConfiguration>
  | ReturnType<typeof setPage>
  | ReturnType<typeof changeAssemblyFlavor>
  | ReturnType<typeof changeBacktrace>
  | ReturnType<typeof changeChannel>
  | ReturnType<typeof changeDemangleAssembly>
  | ReturnType<typeof changeEdition>
  | ReturnType<typeof changeEditor>
  | ReturnType<typeof changeFocus>
  | ReturnType<typeof changeKeybinding>
  | ReturnType<typeof changeMode>
  | ReturnType<typeof changeOrientation>
  | ReturnType<typeof changePrimaryAction>
  | ReturnType<typeof changeProcessAssembly>
  | ReturnType<typeof changeTheme>
  | ReturnType<typeof requestExecute>
  | ReturnType<typeof receiveExecuteSuccess>
  | ReturnType<typeof receiveExecuteFailure>
  | ReturnType<typeof requestCompileAssembly>
  | ReturnType<typeof receiveCompileAssemblySuccess>
  | ReturnType<typeof receiveCompileAssemblyFailure>
  | ReturnType<typeof requestCompileLlvmIr>
  | ReturnType<typeof receiveCompileLlvmIrSuccess>
  | ReturnType<typeof receiveCompileLlvmIrFailure>
  | ReturnType<typeof requestCompileMir>
  | ReturnType<typeof receiveCompileMirSuccess>
  | ReturnType<typeof receiveCompileMirFailure>
  | ReturnType<typeof requestCompileWasm>
  | ReturnType<typeof receiveCompileWasmSuccess>
  | ReturnType<typeof receiveCompileWasmFailure>
  | ReturnType<typeof editCode>
  | ReturnType<typeof addMainFunction>
  | ReturnType<typeof enableFeatureGate>
  | ReturnType<typeof gotoPosition>
  | ReturnType<typeof requestFormat>
  | ReturnType<typeof receiveFormatSuccess>
  | ReturnType<typeof receiveFormatFailure>
  | ReturnType<typeof requestClippy>
  | ReturnType<typeof receiveClippySuccess>
  | ReturnType<typeof receiveClippyFailure>
  | ReturnType<typeof requestMiri>
  | ReturnType<typeof receiveMiriSuccess>
  | ReturnType<typeof receiveMiriFailure>
  | ReturnType<typeof requestGistLoad>
  | ReturnType<typeof receiveGistLoadSuccess>
  | ReturnType<typeof receiveGistLoadFailure>
  | ReturnType<typeof requestGistSave>
  | ReturnType<typeof receiveGistSaveSuccess>
  | ReturnType<typeof receiveGistSaveFailure>
  | ReturnType<typeof requestCratesLoad>
  | ReturnType<typeof receiveCratesLoadSuccess>
  | ReturnType<typeof requestVersionsLoad>
  | ReturnType<typeof receiveVersionsLoadSuccess>
  | ReturnType<typeof notificationSeen>
  ;
