import fetch from 'isomorphic-fetch';
import url from 'url';
import { load as loadGist, save as saveGist } from './gist';

const routes = {
  compile: { pathname: '/compile' },
  execute: { pathname: '/execute' },
  format: { pathname: '/format' },
  clippy: { pathname: '/clippy' }
};

export const TOGGLE_CONFIGURATION = 'TOGGLE_CONFIGURATION';

export function toggleConfiguration() {
  return { type: TOGGLE_CONFIGURATION };
}

export const CHANGE_EDITOR = 'CHANGE_EDITOR';
export const CHANGE_THEME = 'CHANGE_THEME';
export const CHANGE_CHANNEL = 'CHANGE_CHANNEL';
export const CHANGE_MODE = 'CHANGE_MODE';
export const CHANGE_FOCUS = 'CHANGE_FOCUS';

export function changeEditor(editor) {
  return { type: CHANGE_EDITOR, editor };
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

function receiveExecuteSuccess(json) {
  return { type: EXECUTE_SUCCEEDED, stdout: json.stdout, stderr: json.stderr };
}

function receiveExecuteFailure(json) {
  return { type: EXECUTE_FAILED, error: json.error };
}

function jsonPost(urlObj, body) {
  const urlStr = url.format(urlObj);

  return fetch(urlStr, {
    method: 'post',
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })
    .catch(error => { return { error }; })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        return response.json()
          .then(j => Promise.reject(j))
          .catch(e => { return Promise.reject({ error: e.toString() }); });
      }
    });
}

export function performExecute() {
  // TODO: Check a cache
  return function (dispatch, getState) {
    dispatch(requestExecute());

    const state = getState();
    const { code, configuration: { channel, mode, tests } } = state;
    const body = { channel, mode, tests, code };

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
    const { code, configuration: { channel, mode, tests } } = state;
    const body = { channel, mode, tests, code, target };

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

function receiveCompileAssemblySuccess(json) {
  let { code, stdout, stderr } = json;
  return { type: COMPILE_ASSEMBLY_SUCCEEDED, code, stdout, stderr };
}

function receiveCompileAssemblyFailure(json) {
  return { type: COMPILE_ASSEMBLY_FAILED, error: json.error };
}

export const performCompileToAssembly = () =>
  performCompile('asm', {
    request: requestCompileAssembly,
    success: receiveCompileAssemblySuccess,
    failure: receiveCompileAssemblyFailure
  });

export const REQUEST_COMPILE_LLVM_IR = 'REQUEST_COMPILE_LLVM_IR';
export const COMPILE_LLVM_IR_SUCCEEDED = 'COMPILE_LLVM_IR_SUCCEEDED';
export const COMPILE_LLVM_IR_FAILED = 'COMPILE_LLVM_IR_FAILED';

function requestCompileLlvmIr() {
  return { type: REQUEST_COMPILE_LLVM_IR };
}

function receiveCompileLlvmIrSuccess(json) {
  let { code, stdout, stderr } = json;
  return { type: COMPILE_LLVM_IR_SUCCEEDED, code, stdout, stderr };
}

function receiveCompileLlvmIrFailure(json) {
  return { type: COMPILE_LLVM_IR_FAILED, error: json.error };
}

export const performCompileToLLVM = () =>
  performCompile('llvm-ir', {
    request: requestCompileLlvmIr,
    success: receiveCompileLlvmIrSuccess,
    failure: receiveCompileLlvmIrFailure
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

function receiveFormatSuccess(json) {
  return { type: FORMAT_SUCCEEDED, code: json.code };
}

function receiveFormatFailure(json) {
  return { type: FORMAT_FAILED, error: json.error };
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

function receiveClippySuccess(json) {
  const { stdout, stderr } = json;
  return { type: CLIPPY_SUCCEEDED, stdout, stderr };
}

function receiveClippyFailure(json) {
  return { type: CLIPPY_FAILED, error: json.error };
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

function receiveGistLoadSuccess(gist) {
  const { id, url, code } = gist;
  return { type: GIST_LOAD_SUCCEEDED, id, url, code };
}

function receiveGistLoadFailure() { // eslint-disable-line no-unused-vars
  return { type: GIST_LOAD_FAILED };
}

export function performGistLoad(id) {
  return function (dispatch, _getState) {
    dispatch(requestGistLoad());

    loadGist(id)
      .then(gist => dispatch(receiveGistLoadSuccess(gist)));
    // TODO: Failure case
  };
}

export const REQUEST_GIST_SAVE = 'REQUEST_GIST_SAVE';
export const GIST_SAVE_SUCCEEDED = 'GIST_SAVE_SUCCEEDED';
export const GIST_SAVE_FAILED = 'GIST_SAVE_FAILED';

function requestGistSave() {
  return { type: REQUEST_GIST_SAVE };
}

function receiveGistSaveSuccess(json) {
  const { id, url } = json;
  return { type: GIST_SAVE_SUCCEEDED, id, url };
}


function receiveGistSaveFailure(json) { // eslint-disable-line no-unused-vars
  return { type: GIST_SAVE_FAILED, error: json.error };
}

export function performGistSave() {
  return function (dispatch, getState) {
    dispatch(requestGistSave());

    const { code } = getState();

    return saveGist(code)
      .then(json => dispatch(receiveGistSaveSuccess(json)));
    // TODO: Failure case
  };
}
