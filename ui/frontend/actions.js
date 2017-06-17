import fetch from 'isomorphic-fetch';
import url from 'url';
import { load as loadGist, save as saveGist } from './gist';

const routes = {
  compile: { pathname: '/compile' },
  execute: { pathname: '/execute' },
  format: { pathname: '/format' },
  clippy: { pathname: '/clippy' },
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

export const CHANGE_EDITOR = 'CHANGE_EDITOR';
export const CHANGE_KEYBINDING = 'CHANGE_KEYBINDING';
export const CHANGE_THEME = 'CHANGE_THEME';
export const CHANGE_CHANNEL = 'CHANGE_CHANNEL';
export const CHANGE_MODE = 'CHANGE_MODE';
export const CHANGE_FOCUS = 'CHANGE_FOCUS';

export function changeEditor(editor) {
  return { type: CHANGE_EDITOR, editor };
}

export function changeKeybinding(keybinding) {
  return { type: CHANGE_KEYBINDING, keybinding };
}

export function changeTheme(theme) {
  return { type: CHANGE_THEME, theme };
}

export function changeChannel(channel) {
  return { type: CHANGE_CHANNEL, channel };
}

export function changeMode(mode) {
  return { type: CHANGE_MODE, mode };
}

export function changeFocus(focus) {
  return { type: CHANGE_FOCUS, focus };
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

function jsonPost(urlObj, body) {
  const urlStr = url.format(urlObj);

  return fetch(urlStr, {
    method: 'post',
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
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
    const { code, configuration: { channel, mode, crateType, tests } } = state;
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
    const { code, configuration: { channel, mode, crateType, tests } } = state;
    const body = { channel, mode, crateType, tests, code, target };

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

export function indexPageLoad({ code, gist, version = 'stable', mode = 'debug' }) {
  return function (dispatch) {
    dispatch(navigateToIndex());

    if (code) {
      dispatch(editCode(code));
    } else if (gist) {
      dispatch(performGistLoad(gist));
    }

    if (version) {
      dispatch(changeChannel(version));
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
