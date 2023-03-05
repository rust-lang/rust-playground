import fetch from 'isomorphic-fetch';
import { ThunkAction as ReduxThunkAction } from '@reduxjs/toolkit';
import { z } from 'zod';

import {
  codeSelector,
  clippyRequestSelector,
  formatRequestSelector,
  getCrateType,
  runAsTest,
  useWebsocketSelector,
} from './selectors';
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
  PairCharacters,
  PrimaryAction,
  PrimaryActionAuto,
  PrimaryActionCore,
  ProcessAssembly,
  Position,
  makePosition,
  Version,
  Crate,
} from './types';

import { performGistLoad } from './reducers/output/gist';

export const routes = {
  compile: '/compile',
  execute: '/execute',
  format: '/format',
  clippy: '/clippy',
  miri: '/miri',
  macroExpansion: '/macro-expansion',
  meta: {
    crates: '/meta/crates',
    version: {
      stable: '/meta/version/stable',
      beta: '/meta/version/beta',
      nightly: '/meta/version/nightly',
      rustfmt: '/meta/version/rustfmt',
      clippy: '/meta/version/clippy',
      miri: '/meta/version/miri',
    },
    gistSave: '/meta/gist',
    gistLoad: '/meta/gist/id',
  },
};

export type ThunkAction<T = void> = ReduxThunkAction<T, State, {}, Action>;

const createAction = <T extends string, P extends {}>(type: T, props?: P) => (
  Object.assign({ type }, props)
);

export enum ActionType {
  InitializeApplication = 'INITIALIZE_APPLICATION',
  DisableSyncChangesToStorage = 'DISABLE_SYNC_CHANGES_TO_STORAGE',
  SetPage = 'SET_PAGE',
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
  CompileHirRequest = 'COMPILE_HIR_REQUEST',
  CompileHirSucceeded = 'COMPILE_HIR_SUCCEEDED',
  CompileHirFailed = 'COMPILE_HIR_FAILED',
  CompileMirRequest = 'COMPILE_MIR_REQUEST',
  CompileMirSucceeded = 'COMPILE_MIR_SUCCEEDED',
  CompileMirFailed = 'COMPILE_MIR_FAILED',
  CompileWasmRequest = 'COMPILE_WASM_REQUEST',
  CompileWasmSucceeded = 'COMPILE_WASM_SUCCEEDED',
  CompileWasmFailed = 'COMPILE_WASM_FAILED',
  EditCode = 'EDIT_CODE',
  AddMainFunction = 'ADD_MAIN_FUNCTION',
  AddImport = 'ADD_IMPORT',
  EnableFeatureGate = 'ENABLE_FEATURE_GATE',
  GotoPosition = 'GOTO_POSITION',
  SelectText = 'SELECT_TEXT',
  RequestFormat = 'REQUEST_FORMAT',
  FormatSucceeded = 'FORMAT_SUCCEEDED',
  FormatFailed = 'FORMAT_FAILED',
  RequestClippy = 'REQUEST_CLIPPY',
  ClippySucceeded = 'CLIPPY_SUCCEEDED',
  ClippyFailed = 'CLIPPY_FAILED',
  RequestMiri = 'REQUEST_MIRI',
  MiriSucceeded = 'MIRI_SUCCEEDED',
  MiriFailed = 'MIRI_FAILED',
  RequestMacroExpansion = 'REQUEST_MACRO_EXPANSION',
  MacroExpansionSucceeded = 'MACRO_EXPANSION_SUCCEEDED',
  MacroExpansionFailed = 'MACRO_EXPANSION_FAILED',
  RequestCratesLoad = 'REQUEST_CRATES_LOAD',
  CratesLoadSucceeded = 'CRATES_LOAD_SUCCEEDED',
  RequestVersionsLoad = 'REQUEST_VERSIONS_LOAD',
  VersionsLoadSucceeded = 'VERSIONS_LOAD_SUCCEEDED',
  NotificationSeen = 'NOTIFICATION_SEEN',
  BrowserWidthChanged = 'BROWSER_WIDTH_CHANGED',
  SplitRatioChanged = 'SPLIT_RATIO_CHANGED',
  WebSocketError = 'WEBSOCKET_ERROR',
  WebSocketConnected = 'WEBSOCKET_CONNECTED',
  WebSocketDisconnected = 'WEBSOCKET_DISCONNECTED',
  WebSocketFeatureFlagEnabled = 'WEBSOCKET_FEATURE_FLAG_ENABLED',
  WSExecuteRequest = 'WS_EXECUTE_REQUEST',
  WSExecuteResponse = 'WS_EXECUTE_RESPONSE',
}

export const WebSocketError = z.object({
  type: z.literal(ActionType.WebSocketError),
  error: z.string(),
});
export type WebSocketError = z.infer<typeof WebSocketError>;

const ExecuteExtra = z.object({
  sequenceNumber: z.number(),
});
type ExecuteExtra = z.infer<typeof ExecuteExtra>;

export const WSExecuteResponse = z.object({
  type: z.literal(ActionType.WSExecuteResponse),
  success: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  extra: ExecuteExtra,
});
export type WSExecuteResponse = z.infer<typeof WSExecuteResponse>;

export const initializeApplication = () => createAction(ActionType.InitializeApplication);

export const disableSyncChangesToStorage = () => createAction(ActionType.DisableSyncChangesToStorage);

const setPage = (page: Page) =>
  createAction(ActionType.SetPage, { page });

export const navigateToIndex = () => setPage('index');
export const navigateToHelp = () => setPage('help');

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

export const changeEdition = (edition: Edition) =>
  createAction(ActionType.ChangeEdition, { edition });

export const changeBacktrace = (backtrace: Backtrace) =>
  createAction(ActionType.ChangeBacktrace, { backtrace });

export const reExecuteWithBacktrace = (): ThunkAction => dispatch => {
  dispatch(changeBacktrace(Backtrace.Enabled));
  dispatch(performExecuteOnly());
};

export const changeFocus = (focus?: Focus) =>
  createAction(ActionType.ChangeFocus, { focus });

interface ExecuteResponseBody {
  stdout: string;
  stderr: string;
}

const requestExecute = () =>
  createAction(ActionType.ExecuteRequest);

const receiveExecuteSuccess = ({ stdout, stderr }: ExecuteResponseBody) =>
  createAction(ActionType.ExecuteSucceeded, { stdout, stderr });

const receiveExecuteFailure = ({ error }: { error?: string }) =>
  createAction(ActionType.ExecuteFailed, { error });

type FetchArg = Parameters<typeof fetch>[0];

export function jsonGet(url: FetchArg) {
  return fetchJson(url, {
    method: 'get',
  });
}

export function jsonPost<T>(url: FetchArg, body: Record<string, any>): Promise<T> {
  return fetchJson(url, {
    method: 'post',
    body: JSON.stringify(body),
  });
}

async function fetchJson(url: FetchArg, args: RequestInit) {
  const headers = new Headers(args.headers);
  headers.set('Content-Type', 'application/json');

  let response;
  try {
    response = await fetch(url, { ...args, headers });
  } catch (networkError) {
    // e.g. server unreachable
    if (networkError instanceof Error) {
      throw ({
        error: `Network error: ${networkError.toString()}`,
      });
    } else {
      throw ({
        error: 'Unknown error while fetching JSON',
      });
    }
  }

  let body;
  try {
    body = await response.json();
  } catch (convertError) {
    if (convertError instanceof Error) {
      throw ({
        error: `Response was not JSON: ${convertError.toString()}`,
      });
    } else {
      throw ({
        error: 'Unknown error while converting JSON',
      });
    }
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

const performCommonExecute = (crateType: string, tests: boolean): ThunkAction => (dispatch, getState) => {
  const state = getState();
  const code = codeSelector(state);
  const { configuration: { channel, mode, edition } } = state;
  const backtrace = state.configuration.backtrace === Backtrace.Enabled;

  if (useWebsocketSelector(state)) {
    return dispatch(wsExecuteRequest(channel, mode, edition, crateType, tests, code, backtrace));
  } else {
    dispatch(requestExecute());

    const body: ExecuteRequestBody = { channel, mode, edition, crateType, tests, code, backtrace };

    return jsonPost<ExecuteResponseBody>(routes.execute, body)
      .then(json => dispatch(receiveExecuteSuccess(json)))
      .catch(json => dispatch(receiveExecuteFailure(json)));
  }
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

type CompileResponseBody = CompileSuccess;

interface CompileSuccess {
  code: string;
  stdout: string;
  stderr: string;
}

interface CompileFailure {
  error: string;
}

function performCompileShow(
  target: string,
  { request, success, failure }: {
    request: () => Action,
    success: (body: CompileResponseBody) => Action,
    failure: (f: CompileFailure) => Action,
  }): ThunkAction {
  // TODO: Check a cache
  return function(dispatch, getState) {
    dispatch(request());

    const state = getState();
    const code = codeSelector(state);
    const { configuration: {
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

    return jsonPost<CompileResponseBody>(routes.compile, body)
      .then(json => dispatch(success(json)))
      .catch(json => dispatch(failure(json)));
  };
}

const requestCompileAssembly = () =>
  createAction(ActionType.CompileAssemblyRequest);

const receiveCompileAssemblySuccess = ({ code, stdout, stderr }: CompileSuccess) =>
  createAction(ActionType.CompileAssemblySucceeded, { code, stdout, stderr });

const receiveCompileAssemblyFailure = ({ error }: CompileFailure) =>
  createAction(ActionType.CompileAssemblyFailed, { error });

const performCompileToAssemblyOnly = () =>
  performCompileShow('asm', {
    request: requestCompileAssembly,
    success: receiveCompileAssemblySuccess,
    failure: receiveCompileAssemblyFailure,
  });

const requestCompileLlvmIr = () =>
  createAction(ActionType.CompileLlvmIrRequest);

const receiveCompileLlvmIrSuccess = ({ code, stdout, stderr }: CompileSuccess) =>
  createAction(ActionType.CompileLlvmIrSucceeded, { code, stdout, stderr });

const receiveCompileLlvmIrFailure = ({ error }: CompileFailure) =>
  createAction(ActionType.CompileLlvmIrFailed, { error });

const performCompileToLLVMOnly = () =>
  performCompileShow('llvm-ir', {
    request: requestCompileLlvmIr,
    success: receiveCompileLlvmIrSuccess,
    failure: receiveCompileLlvmIrFailure,
  });

const requestCompileHir = () =>
  createAction(ActionType.CompileHirRequest);

const receiveCompileHirSuccess = ({ code, stdout, stderr }: CompileSuccess) =>
  createAction(ActionType.CompileHirSucceeded, { code, stdout, stderr });

const receiveCompileHirFailure = ({ error }: CompileFailure) =>
  createAction(ActionType.CompileHirFailed, { error });

const performCompileToHirOnly = () =>
  performCompileShow('hir', {
    request: requestCompileHir,
    success: receiveCompileHirSuccess,
    failure: receiveCompileHirFailure,
  });

const performCompileToNightlyHirOnly = (): ThunkAction => dispatch => {
  dispatch(changeChannel(Channel.Nightly));
  dispatch(performCompileToHirOnly());
};

const requestCompileMir = () =>
  createAction(ActionType.CompileMirRequest);

const receiveCompileMirSuccess = ({ code, stdout, stderr }: CompileSuccess) =>
  createAction(ActionType.CompileMirSucceeded, { code, stdout, stderr });

const receiveCompileMirFailure = ({ error }: CompileFailure) =>
  createAction(ActionType.CompileMirFailed, { error });

const performCompileToMirOnly = () =>
  performCompileShow('mir', {
    request: requestCompileMir,
    success: receiveCompileMirSuccess,
    failure: receiveCompileMirFailure,
  });

const requestCompileWasm = () =>
  createAction(ActionType.CompileWasmRequest);

const receiveCompileWasmSuccess = ({ code, stdout, stderr }: CompileSuccess) =>
  createAction(ActionType.CompileWasmSucceeded, { code, stdout, stderr });

const receiveCompileWasmFailure = ({ error }: CompileFailure) =>
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
  [PrimaryActionCore.Hir]: performCompileToHirOnly,
  [PrimaryActionCore.Mir]: performCompileToMirOnly,
  [PrimaryActionCore.Wasm]: performCompileToNightlyWasmOnly,
};

let sequenceNumber = 0;
const nextSequenceNumber = () => sequenceNumber++;
const makeExtra = (): ExecuteExtra => ({
  sequenceNumber: nextSequenceNumber(),
});

const wsExecuteRequest = (
  channel: Channel,
  mode: Mode,
  edition: Edition,
  crateType: string,
  tests: boolean,
  code: string,
  backtrace: boolean
) =>
  createAction(ActionType.WSExecuteRequest, {
    channel,
    mode,
    edition,
    crateType,
    tests,
    code,
    backtrace,
    extra: makeExtra(),
  });

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
export const performCompileToNightlyHir =
  performAndSwitchPrimaryAction(performCompileToNightlyHirOnly, PrimaryActionCore.Hir);
export const performCompileToNightlyWasm =
  performAndSwitchPrimaryAction(performCompileToNightlyWasmOnly, PrimaryActionCore.Wasm);

export const editCode = (code: string) =>
  createAction(ActionType.EditCode, { code });

export const addMainFunction = () =>
  createAction(ActionType.AddMainFunction);

export const addImport = (code: string) =>
  createAction(ActionType.AddImport, { code });

export const enableFeatureGate = (featureGate: string) =>
  createAction(ActionType.EnableFeatureGate, { featureGate });

export const gotoPosition = (line: string | number, column: string | number) =>
  createAction(ActionType.GotoPosition, makePosition(line, column));

export const selectText = (start: Position, end: Position) =>
  createAction(ActionType.SelectText, { start, end });

const requestFormat = () =>
  createAction(ActionType.RequestFormat);

interface FormatRequestBody {
  code: string;
  edition: string;
}

interface FormatResponseBody {
  success: boolean;
  code: string;
  stdout: string;
  stderr: string;
}

const receiveFormatSuccess = (body: FormatResponseBody) =>
  createAction(ActionType.FormatSucceeded, body);

const receiveFormatFailure = (body: FormatResponseBody) =>
  createAction(ActionType.FormatFailed, body);

export function performFormat(): ThunkAction {
  // TODO: Check a cache
  return function(dispatch, getState) {
    dispatch(requestFormat());

    const body: FormatRequestBody = formatRequestSelector(getState());

    return jsonPost<FormatResponseBody>(routes.format, body)
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

interface GeneralSuccess {
  stdout: string;
  stderr: string;
}

const requestClippy = () =>
  createAction(ActionType.RequestClippy);

interface ClippyRequestBody {
  code: string;
  edition: string;
  crateType: string;
}

interface ClippyResponseBody {
  success: boolean;
  stdout: string;
  stderr: string;
}

type ClippySuccess = GeneralSuccess;

const receiveClippySuccess = ({ stdout, stderr }: ClippySuccess) =>
  createAction(ActionType.ClippySucceeded, { stdout, stderr });

const receiveClippyFailure = ({ error }: CompileFailure) =>
  createAction(ActionType.ClippyFailed, { error });

export function performClippy(): ThunkAction {
  // TODO: Check a cache
  return function(dispatch, getState) {
    dispatch(requestClippy());

    const body: ClippyRequestBody = clippyRequestSelector(getState());

    return jsonPost<ClippyResponseBody>(routes.clippy, body)
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

interface MiriResponseBody {
  success: boolean;
  stdout: string;
  stderr: string;
}

type MiriSuccess = GeneralSuccess;

const receiveMiriSuccess = ({ stdout, stderr }: MiriSuccess) =>
  createAction(ActionType.MiriSucceeded, { stdout, stderr });

const receiveMiriFailure = ({ error }: CompileFailure) =>
  createAction(ActionType.MiriFailed, { error });

export function performMiri(): ThunkAction {
  // TODO: Check a cache
  return function(dispatch, getState) {
    dispatch(requestMiri());

    const state = getState();
    const code = codeSelector(state);
    const { configuration: {
      edition,
    } } = state;
    const body: MiriRequestBody = { code, edition };

    return jsonPost<MiriResponseBody>(routes.miri, body)
      .then(json => dispatch(receiveMiriSuccess(json)))
      .catch(json => dispatch(receiveMiriFailure(json)));
  };
}

const requestMacroExpansion = () =>
  createAction(ActionType.RequestMacroExpansion);

interface MacroExpansionRequestBody {
  code: string;
  edition: string;
}

interface MacroExpansionResponseBody {
  success: boolean;
  stdout: string;
  stderr: string;
}

type MacroExpansionSuccess = GeneralSuccess;

const receiveMacroExpansionSuccess = ({ stdout, stderr }: MacroExpansionSuccess) =>
  createAction(ActionType.MacroExpansionSucceeded, { stdout, stderr });

const receiveMacroExpansionFailure = ({ error }: CompileFailure) =>
  createAction(ActionType.MacroExpansionFailed, { error });

export function performMacroExpansion(): ThunkAction {
  // TODO: Check a cache
  return function(dispatch, getState) {
    dispatch(requestMacroExpansion());

    const state = getState();
    const code = codeSelector(state);
    const { configuration: {
      edition,
    } } = state;
    const body: MacroExpansionRequestBody = { code, edition };

    return jsonPost<MacroExpansionResponseBody>(routes.macroExpansion, body)
      .then(json => dispatch(receiveMacroExpansionSuccess(json)))
      .catch(json => dispatch(receiveMacroExpansionFailure(json)));
  };
}

const requestCratesLoad = () =>
  createAction(ActionType.RequestCratesLoad);

const receiveCratesLoadSuccess = ({ crates }: { crates: Crate[] }) =>
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

const receiveVersionsLoadSuccess = ({
  stable, beta, nightly, rustfmt, clippy, miri,
}: {
  stable: Version, beta: Version, nightly: Version, rustfmt: Version, clippy: Version, miri: Version,
}) =>
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

export const seenRustSurvey2022 = () => notificationSeen(Notification.RustSurvey2022);

export const browserWidthChanged = (isSmall: boolean) =>
  createAction(ActionType.BrowserWidthChanged, { isSmall });

export const splitRatioChanged = () =>
  createAction(ActionType.SplitRatioChanged);

export const websocketError = (error: string): WebSocketError => createAction(ActionType.WebSocketError, { error });
export const websocketConnected = () => createAction(ActionType.WebSocketConnected);
export const websocketDisconnected = () => createAction(ActionType.WebSocketDisconnected);
export const websocketFeatureFlagEnabled = () => createAction(ActionType.WebSocketFeatureFlagEnabled);

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
    dispatch(changeEdition(edition));
  };
}

export function helpPageLoad() {
  return navigateToHelp();
}

export function showExample(code: string): ThunkAction {
  return function(dispatch) {
    dispatch(navigateToIndex());
    dispatch(editCode(code));
  };
}

export type Action =
  | ReturnType<typeof initializeApplication>
  | ReturnType<typeof disableSyncChangesToStorage>
  | ReturnType<typeof setPage>
  | ReturnType<typeof changePairCharacters>
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
  | ReturnType<typeof changeAceTheme>
  | ReturnType<typeof changeMonacoTheme>
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
  | ReturnType<typeof requestCompileHir>
  | ReturnType<typeof receiveCompileHirSuccess>
  | ReturnType<typeof receiveCompileHirFailure>
  | ReturnType<typeof requestCompileWasm>
  | ReturnType<typeof receiveCompileWasmSuccess>
  | ReturnType<typeof receiveCompileWasmFailure>
  | ReturnType<typeof editCode>
  | ReturnType<typeof addMainFunction>
  | ReturnType<typeof addImport>
  | ReturnType<typeof enableFeatureGate>
  | ReturnType<typeof gotoPosition>
  | ReturnType<typeof selectText>
  | ReturnType<typeof requestFormat>
  | ReturnType<typeof receiveFormatSuccess>
  | ReturnType<typeof receiveFormatFailure>
  | ReturnType<typeof requestClippy>
  | ReturnType<typeof receiveClippySuccess>
  | ReturnType<typeof receiveClippyFailure>
  | ReturnType<typeof requestMiri>
  | ReturnType<typeof receiveMiriSuccess>
  | ReturnType<typeof receiveMiriFailure>
  | ReturnType<typeof requestMacroExpansion>
  | ReturnType<typeof receiveMacroExpansionSuccess>
  | ReturnType<typeof receiveMacroExpansionFailure>
  | ReturnType<typeof requestCratesLoad>
  | ReturnType<typeof receiveCratesLoadSuccess>
  | ReturnType<typeof requestVersionsLoad>
  | ReturnType<typeof receiveVersionsLoadSuccess>
  | ReturnType<typeof notificationSeen>
  | ReturnType<typeof browserWidthChanged>
  | ReturnType<typeof splitRatioChanged>
  | ReturnType<typeof websocketError>
  | ReturnType<typeof websocketConnected>
  | ReturnType<typeof websocketDisconnected>
  | ReturnType<typeof websocketFeatureFlagEnabled>
  | ReturnType<typeof wsExecuteRequest>
  | WSExecuteResponse
  ;
