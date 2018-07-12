import fetch from 'isomorphic-fetch';
import { ThunkAction as ReduxThunkAction } from 'redux-thunk';
import url from 'url';

import { getCrateType, isEditionAvailable, runAsTest } from './selectors';
import State from './state';
import {
  AssemblyFlavor,
  Channel,
  DemangleAssembly,
  Edition,
  Editor,
  Mode,
  Orientation,
  Page,
  ProcessAssembly,
} from './types';

const routes = {
  compile: { pathname: '/compile' },
  execute: { pathname: '/execute' },
  format: { pathname: '/format' },
  clippy: { pathname: '/clippy' },
  meta: {
    crates: { pathname: '/meta/crates' },
    version: {
      stable: '/meta/version/stable',
      beta: '/meta/version/beta',
      nightly: '/meta/version/nightly',
    },
    gist: { pathname: '/meta/gist/' },
  },
};

type ThunkAction<T = void> = ReduxThunkAction<T, State, {}>;

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
  ChangeChannel = 'CHANGE_CHANNEL',
  ChangeDemangleAssembly = 'CHANGE_DEMANGLE_ASSEMBLY',
  ChangeProcessAssembly = 'CHANGE_PROCESS_ASSEMBLY',
  ChangeMode = 'CHANGE_MODE',
  ChangeEdition = 'CHANGE_EDITION',
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
  GotoPosition = 'GOTO_POSITION',
  RequestFormat = 'REQUEST_FORMAT',
  FormatSucceeded = 'FORMAT_SUCCEEDED',
  FormatFailed = 'FORMAT_FAILED',
  RequestClippy = 'REQUEST_CLIPPY',
  ClippySucceeded = 'CLIPPY_SUCCEEDED',
  ClippyFailed = 'CLIPPY_FAILED',
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

export const changeChannel = (channel: Channel) =>
  createAction(ActionType.ChangeChannel, { channel });

export const changeMode = (mode: Mode) =>
  createAction(ActionType.ChangeMode, { mode });

export const changeEdition = (edition: Edition) =>
  createAction(ActionType.ChangeEdition, { edition });

export const changeNightlyEdition: ThunkAction = (edition: Edition) => dispatch => {
  dispatch(changeChannel(Channel.Nightly));
  dispatch(changeEdition(edition));
};

export const changeFocus = focus =>
  createAction(ActionType.ChangeFocus, { focus });

const requestExecute = () =>
  createAction(ActionType.ExecuteRequest);

const receiveExecuteSuccess = ({ stdout, stderr }) =>
  createAction(ActionType.ExecuteSucceeded, { stdout, stderr });

const receiveExecuteFailure = ({ error }) =>
  createAction(ActionType.ExecuteFailed, { error });

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

function fetchJson(url, args) {
  const { headers = {} } = args;
  headers['Content-Type'] = 'application/json';

  return fetch(url, { ...args, headers })
    .catch(error => error)
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        return response.json()
          .catch(e => Promise.reject({ error: e.toString() }))
          .then(j => Promise.reject(j));
      }
    });
}

interface ExecuteRequestBody {
  channel: string;
  mode: string;
  crateType: string;
  tests: boolean;
  code: string;
  edition?: string;
}

export function performExecute(): ThunkAction {
  // TODO: Check a cache
  return function(dispatch, getState) {
    dispatch(requestExecute());

    const state = getState();
    const { code, configuration: { channel, mode, edition } } = state;
    const crateType = getCrateType(state);
    const tests = runAsTest(state);

    const body: ExecuteRequestBody = { channel, mode, crateType, tests, code };
    if (isEditionAvailable(state)) {
      body.edition = edition;
    }

    return jsonPost(routes.execute, body)
      .then(json => dispatch(receiveExecuteSuccess(json)))
      .catch(json => dispatch(receiveExecuteFailure(json)));
  };
}

interface CompileRequestBody extends ExecuteRequestBody {
  target: string;
  assemblyFlavor: string;
  demangleAssembly: string;
  processAssembly: string;
}

function performCompile(target, { request, success, failure }): ThunkAction {
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
    const body: CompileRequestBody = {
      channel,
      mode,
      crateType,
      tests,
      code,
      target,
      assemblyFlavor,
      demangleAssembly,
      processAssembly,
    };
    if (isEditionAvailable(state)) {
      body.edition = edition;
    }

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

export const performCompileToAssembly = () =>
  performCompile('asm', {
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

export const performCompileToLLVM = () =>
  performCompile('llvm-ir', {
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

export const performCompileToMir = () =>
  performCompile('mir', {
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

export const performCompileToWasm = () =>
  performCompile('wasm', {
    request: requestCompileWasm,
    success: receiveCompileWasmSuccess,
    failure: receiveCompileWasmFailure,
  });

export const performCompileToNightlyWasm: ThunkAction = () => dispatch => {
  dispatch(changeChannel(Channel.Nightly));
  dispatch(performCompileToWasm());
};

export const editCode = code =>
  createAction(ActionType.EditCode, { code });

export const gotoPosition = (line, column) =>
  createAction(ActionType.GotoPosition, { line: +line, column: +column });

const requestFormat = () =>
  createAction(ActionType.RequestFormat);

const receiveFormatSuccess = ({ code }) =>
  createAction(ActionType.FormatSucceeded, { code });

const receiveFormatFailure = ({ error }) =>
  createAction(ActionType.FormatFailed, { error });

export function performFormat(): ThunkAction {
  // TODO: Check a cache
  return function(dispatch, getState) {
    dispatch(requestFormat());

    const { code } = getState();
    const body = { code };

    return jsonPost(routes.format, body)
      .then(json => dispatch(receiveFormatSuccess(json)))
      .catch(json => dispatch(receiveFormatFailure(json)));
  };
}

const requestClippy = () =>
  createAction(ActionType.RequestClippy);

const receiveClippySuccess = ({ stdout, stderr }) =>
  createAction(ActionType.ClippySucceeded, { stdout, stderr });

const receiveClippyFailure = ({ error }) =>
  createAction(ActionType.ClippyFailed, { error });

export function performClippy(): ThunkAction {
  // TODO: Check a cache
  return function(dispatch, getState) {
    dispatch(requestClippy());

    const { code } = getState();
    const body = { code };

    return jsonPost(routes.clippy, body)
      .then(json => dispatch(receiveClippySuccess(json)))
      .catch(json => dispatch(receiveClippyFailure(json)));
  };
}

const requestGistLoad = () =>
  createAction(ActionType.RequestGistLoad);

const receiveGistLoadSuccess = ({ id, url, code, channel, mode, edition }) =>
  createAction(ActionType.GistLoadSucceeded, { id, url, code, channel, mode, edition });

const receiveGistLoadFailure = () => // eslint-disable-line no-unused-vars
  createAction(ActionType.GistLoadFailed);

export function performGistLoad({ id, channel, mode, edition }): ThunkAction {
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

const receiveGistSaveSuccess = ({ id, url, channel, mode, edition }) =>
  createAction(ActionType.GistSaveSucceeded, { id, url, channel, mode, edition });

const receiveGistSaveFailure = ({ error }) => // eslint-disable-line no-unused-vars
  createAction(ActionType.GistSaveFailed, { error });

export function performGistSave() {
  return function(dispatch, getState): ThunkAction {
    dispatch(requestGistSave());

    const { code, configuration: { channel, mode, edition } } = getState();

    return jsonPost(routes.meta.gist, { code })
      .then(json => dispatch(receiveGistSaveSuccess({ ...json, channel, mode, edition })));
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

const receiveVersionsLoadSuccess = ({ stable, beta, nightly }) =>
  createAction(ActionType.VersionsLoadSucceeded, { stable, beta, nightly });

export function performVersionsLoad(): ThunkAction {
  return function(dispatch) {
    dispatch(requestVersionsLoad());

    const stable = jsonGet(routes.meta.version.stable);
    const beta = jsonGet(routes.meta.version.beta);
    const nightly = jsonGet(routes.meta.version.nightly);

    const all = Promise.all([stable, beta, nightly]);

    return all
      .then(([stable, beta, nightly]) => dispatch(receiveVersionsLoadSuccess({
        stable,
        beta,
        nightly,
      })));
    // TODO: Failure case
  };
}

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
    const edition = parseEdition(editionString);

    dispatch(navigateToIndex());

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
    } else if (code || gist) {
      // We need to ensure that any links that predate the existence
      // of editions will *forever* pick 2015. However, if we aren't
      // loading code, then allow the edition to remain the default.
      dispatch(changeEdition(Edition.Rust2015));
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
  | ReturnType<typeof changeChannel>
  | ReturnType<typeof changeDemangleAssembly>
  | ReturnType<typeof changeEditor>
  | ReturnType<typeof changeFocus>
  | ReturnType<typeof changeProcessAssembly>
  | ReturnType<typeof changeKeybinding>
  | ReturnType<typeof changeMode>
  | ReturnType<typeof changeEdition>
  | ReturnType<typeof changeOrientation>
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
  | ReturnType<typeof gotoPosition>
  | ReturnType<typeof requestFormat>
  | ReturnType<typeof receiveFormatSuccess>
  | ReturnType<typeof receiveFormatFailure>
  | ReturnType<typeof requestClippy>
  | ReturnType<typeof receiveClippySuccess>
  | ReturnType<typeof receiveClippyFailure>
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
  ;
