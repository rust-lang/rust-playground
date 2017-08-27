import fetch from 'isomorphic-fetch';
import url from 'url';
import { load as loadGist, save as saveGist } from './gist';
import { getCrateType, runAsTest } from './selectors';
import { Channel } from './types';

const routes = {
  compile: { pathname: '/compile' },
  execute: { pathname: '/execute' },
  format: { pathname: '/format' },
  clippy: { pathname: '/clippy' },
  meta: {
    crates: { pathname: '/meta/crates' },
  },
};

export const TOGGLE_CONFIGURATION = 'TOGGLE_CONFIGURATION';

export function toggleConfiguration() {
  return { type: TOGGLE_CONFIGURATION };
}

export const SET_PAGE = 'SET_PAGE';

export function navigateToIndex() {
  return { type: SET_PAGE, page: 'index' };
}

export function navigateToHelp() {
  return { type: SET_PAGE, page: 'help' };
}

export enum ActionType {
  ToggleConfiguration = 'TOGGLE_CONFIGURATION',
  ChangeEditor = 'CHANGE_EDITOR',
  ChangeKeybinding = 'CHANGE_KEYBINDING',
  ChangeTheme = 'CHANGE_THEME',
  ChangeOrientation = 'CHANGE_ORIENTATION',
  ChangeAssemblyFlavor = 'CHANGE_ASSEMBLY_FLAVOR',
  ChangeChannel = 'CHANGE_CHANNEL',
  ChangeMode = 'CHANGE_MODE',
  ChangeFocus = 'CHANGE_FOCUS',
  Other = '__never_used__',
}

export type Action =
  | ToggleConfigurationAction
  | ChangeAssemblyFlavorAction
  | ChangeChannelAction
  | ChangeEditorAction
  | ChangeFocusAction
  | ChangeKeybindingAction
  | ChangeModeAction
  | ChangeOrientationAction
  | ChangeThemeAction
  | OtherAction
;

export interface ToggleConfigurationAction {
  type: ActionType.ToggleConfiguration;
}

export interface ChangeEditorAction {
  type: ActionType.ChangeEditor;
  editor: string;
}

export interface ChangeKeybindingAction {
  type: ActionType.ChangeKeybinding;
  keybinding: string;
}

export interface ChangeThemeAction {
  type: ActionType.ChangeTheme;
  theme: string;
}

export interface ChangeOrientationAction {
  type: ActionType.ChangeOrientation;
  orientation: string;
}

export interface ChangeAssemblyFlavorAction {
  type: ActionType.ChangeAssemblyFlavor;
  assemblyFlavor: string;
}

export interface ChangeChannelAction {
  type: ActionType.ChangeChannel;
  channel: Channel;
}

export interface ChangeModeAction {
  type: ActionType.ChangeMode;
  mode: string;
}

export interface ChangeFocusAction {
  type: ActionType.ChangeFocus;
  focus: string;
}

export interface OtherAction {
  type: ActionType.Other;
}

export function changeEditor(editor): ChangeEditorAction {
  return { type: ActionType.ChangeEditor, editor };
}

export function changeKeybinding(keybinding): ChangeKeybindingAction {
  return { type: ActionType.ChangeKeybinding, keybinding };
}

export function changeTheme(theme): ChangeThemeAction {
  return { type: ActionType.ChangeTheme, theme };
}

export function changeOrientation(orientation): ChangeOrientationAction {
  return { type: ActionType.ChangeOrientation, orientation };
}

export function changeAssemblyFlavor(assemblyFlavor): ChangeAssemblyFlavorAction {
  return { type: ActionType.ChangeAssemblyFlavor, assemblyFlavor };
}

export function changeChannel(channel: Channel): ChangeChannelAction {
  return { type: ActionType.ChangeChannel, channel };
}

export function changeMode(mode): ChangeModeAction {
  return { type: ActionType.ChangeMode, mode };
}

export function changeFocus(focus): ChangeFocusAction {
  return { type: ActionType.ChangeFocus, focus };
}

export const REQUEST_EXECUTE = 'REQUEST_EXECUTE';
export const EXECUTE_SUCCEEDED = 'EXECUTE_SUCCEEDED';
export const EXECUTE_FAILED = 'EXECUTE_FAILED';

function requestExecute() {
  return { type: REQUEST_EXECUTE };
}

function receiveExecuteSuccess({ stdout, stderr }) {
  return { type: EXECUTE_SUCCEEDED, stdout, stderr };
}

function receiveExecuteFailure({ error }) {
  return { type: EXECUTE_FAILED, error };
}

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
  headers["Content-Type"] = "application/json";

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

export function performExecute() {
  // TODO: Check a cache
  return function (dispatch, getState) {
    dispatch(requestExecute());

    const state = getState();
    const { code, configuration: { channel, mode } } = state;
    const crateType = getCrateType(state);
    const tests = runAsTest(state);

    const body = { channel, mode, crateType, tests, code };

    return jsonPost(routes.execute, body)
      .then(json => dispatch(receiveExecuteSuccess(json)))
      .catch(json => dispatch(receiveExecuteFailure(json)));
  };
}

function performCompile(target, { request, success, failure }) {
  // TODO: Check a cache
  return function (dispatch, getState) {
    dispatch(request());

    const state = getState();
    const { code, configuration: { channel, mode, assemblyFlavor } } = state;
    const crateType = getCrateType(state);
    const tests = runAsTest(state);
    const body = { channel, mode, crateType, tests, code, target, assemblyFlavor };

    return jsonPost(routes.compile, body)
      .then(json => dispatch(success(json)))
      .catch(json => dispatch(failure(json)));
  };
}

export const REQUEST_COMPILE_ASSEMBLY = 'REQUEST_COMPILE_ASSEMBLY';
export const COMPILE_ASSEMBLY_SUCCEEDED = 'COMPILE_ASSEMBLY_SUCCEEDED';
export const COMPILE_ASSEMBLY_FAILED = 'COMPILE_ASSEMBLY_FAILED';

function requestCompileAssembly() {
  return { type: REQUEST_COMPILE_ASSEMBLY };
}

function receiveCompileAssemblySuccess({ code, stdout, stderr }) {
  return { type: COMPILE_ASSEMBLY_SUCCEEDED, code, stdout, stderr };
}

function receiveCompileAssemblyFailure({ error }) {
  return { type: COMPILE_ASSEMBLY_FAILED, error };
}

export const performCompileToAssembly = () =>
  performCompile('asm', {
    request: requestCompileAssembly,
    success: receiveCompileAssemblySuccess,
    failure: receiveCompileAssemblyFailure,
  });

export const REQUEST_COMPILE_LLVM_IR = 'REQUEST_COMPILE_LLVM_IR';
export const COMPILE_LLVM_IR_SUCCEEDED = 'COMPILE_LLVM_IR_SUCCEEDED';
export const COMPILE_LLVM_IR_FAILED = 'COMPILE_LLVM_IR_FAILED';

function requestCompileLlvmIr() {
  return { type: REQUEST_COMPILE_LLVM_IR };
}

function receiveCompileLlvmIrSuccess({ code, stdout, stderr }) {
  return { type: COMPILE_LLVM_IR_SUCCEEDED, code, stdout, stderr };
}

function receiveCompileLlvmIrFailure({ error }) {
  return { type: COMPILE_LLVM_IR_FAILED, error };
}

export const performCompileToLLVM = () =>
  performCompile('llvm-ir', {
    request: requestCompileLlvmIr,
    success: receiveCompileLlvmIrSuccess,
    failure: receiveCompileLlvmIrFailure,
  });

export const REQUEST_COMPILE_MIR = 'REQUEST_COMPILE_MIR';
export const COMPILE_MIR_SUCCEEDED = 'COMPILE_MIR_SUCCEEDED';
export const COMPILE_MIR_FAILED = 'COMPILE_MIR_FAILED';

function requestCompileMir() {
  return { type: REQUEST_COMPILE_MIR };
}

function receiveCompileMirSuccess({ code, stdout, stderr }) {
  return { type: COMPILE_MIR_SUCCEEDED, code, stdout, stderr };
}

function receiveCompileMirFailure({ error }) {
  return { type: COMPILE_MIR_FAILED, error };
}

export const performCompileToMir = () =>
  performCompile('mir', {
    request: requestCompileMir,
    success: receiveCompileMirSuccess,
    failure: receiveCompileMirFailure,
  });

export const EDIT_CODE = 'EDIT_CODE';
export const GOTO_POSITION = 'GOTO_POSITION';

export function editCode(code) {
  return { type: EDIT_CODE, code };
}

export function gotoPosition(line, column) {
  return { type: GOTO_POSITION, line: +line, column: +column };
}

export const REQUEST_FORMAT = 'REQUEST_FORMAT';
export const FORMAT_SUCCEEDED = 'FORMAT_SUCCEEDED';
export const FORMAT_FAILED = 'FORMAT_FAILED';

function requestFormat() {
  return { type: REQUEST_FORMAT };
}

function receiveFormatSuccess({ code }) {
  return { type: FORMAT_SUCCEEDED, code };
}

function receiveFormatFailure({ error }) {
  return { type: FORMAT_FAILED, error };
}

export function performFormat() {
  // TODO: Check a cache
  return function (dispatch, getState) {
    dispatch(requestFormat());

    const { code } = getState();
    const body = { code };

    return jsonPost(routes.format, body)
      .then(json => dispatch(receiveFormatSuccess(json)))
      .catch(json => dispatch(receiveFormatFailure(json)));
  };
}

export const REQUEST_CLIPPY = 'REQUEST_CLIPPY';
export const CLIPPY_SUCCEEDED = 'CLIPPY_SUCCEEDED';
export const CLIPPY_FAILED = 'CLIPPY_FAILED';

function requestClippy() {
  return { type: REQUEST_CLIPPY };
}

function receiveClippySuccess({ stdout, stderr }) {
  return { type: CLIPPY_SUCCEEDED, stdout, stderr };
}

function receiveClippyFailure({ error }) {
  return { type: CLIPPY_FAILED, error };
}

export function performClippy() {
  // TODO: Check a cache
  return function (dispatch, getState) {
    dispatch(requestClippy());

    const { code } = getState();
    const body = { code };

    return jsonPost(routes.clippy, body)
      .then(json => dispatch(receiveClippySuccess(json)))
      .catch(json => dispatch(receiveClippyFailure(json)));
  };
}

export const REQUEST_GIST_LOAD = 'REQUEST_GIST_LOAD';
export const GIST_LOAD_SUCCEEDED = 'GIST_LOAD_SUCCEEDED';
export const GIST_LOAD_FAILED = 'GIST_LOAD_FAILED';

function requestGistLoad() {
  return { type: REQUEST_GIST_LOAD };
}

function receiveGistLoadSuccess({ id, url, code }) {
  return { type: GIST_LOAD_SUCCEEDED, id, url, code };
}

function receiveGistLoadFailure() { // eslint-disable-line no-unused-vars
  return { type: GIST_LOAD_FAILED };
}

export function performGistLoad(id) {
  return function (dispatch, _getState) {
    dispatch(requestGistLoad());

    loadGist(id)
      .then(gist => dispatch(receiveGistLoadSuccess({ ...gist })));
    // TODO: Failure case
  };
}

export const REQUEST_GIST_SAVE = 'REQUEST_GIST_SAVE';
export const GIST_SAVE_SUCCEEDED = 'GIST_SAVE_SUCCEEDED';
export const GIST_SAVE_FAILED = 'GIST_SAVE_FAILED';

function requestGistSave() {
  return { type: REQUEST_GIST_SAVE };
}

function receiveGistSaveSuccess({ id, url, channel }) {
  return { type: GIST_SAVE_SUCCEEDED, id, url, channel };
}

function receiveGistSaveFailure({ error }) { // eslint-disable-line no-unused-vars
  return { type: GIST_SAVE_FAILED, error };
}

export function performGistSave() {
  return function (dispatch, getState) {
    dispatch(requestGistSave());

    const { code, configuration: { channel } } = getState();

    return saveGist(code)
      .then(json => dispatch(receiveGistSaveSuccess({ ...json, channel })));
    // TODO: Failure case
  };
}

export const REQUEST_CRATES_LOAD = 'REQUEST_CRATES_LOAD';
export const CRATES_LOAD_SUCCEEDED = 'CRATES_LOAD_SUCCEEDED';

function requestCratesLoad() {
  return { type: REQUEST_CRATES_LOAD };
}

function receiveCratesLoadSuccess({ crates }) {
  return { type: CRATES_LOAD_SUCCEEDED, crates };
}

export function performCratesLoad() {
  return function(dispatch) {
    dispatch(requestCratesLoad());

    return jsonGet(routes.meta.crates)
      .then(json => dispatch(receiveCratesLoadSuccess(json)));
    // TODO: Failure case
  };
}

function parseChannel(s: string): Channel | null {
  switch (s) {
  case "stable":
    return Channel.Stable;
  case "beta":
    return Channel.Beta;
  case "nightly":
    return Channel.Nightly;
  default:
    return null;
  }
}

export function indexPageLoad({ code, gist, version = 'stable', mode = 'debug' }) {
  return function (dispatch) {
    dispatch(navigateToIndex());

    if (code) {
      dispatch(editCode(code));
    } else if (gist) {
      dispatch(performGistLoad(gist));
    }

    if (version) {
      const channel = parseChannel(version);
      if (channel) { dispatch(changeChannel(channel)) };
    }

    if (mode) {
      dispatch(changeMode(mode));
    }
  };
}

export function helpPageLoad() {
  return navigateToHelp();
}

export function showExample(code) {
  return function (dispatch) {
    dispatch(navigateToIndex());
    dispatch(editCode(code));
  };
}
