import fetch from 'isomorphic-fetch';
import url from 'url';
import { load as loadGist, save as saveGist } from './gist';

export const CHANGE_CHANNEL = 'CHANGE_CHANNEL';
export const CHANGE_MODE = 'CHANGE_MODE';

export function changeChannel(channel) {
  return { type: CHANGE_CHANNEL, channel };
}

export function changeMode(mode) {
  return { type: CHANGE_MODE, mode };
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

const routes = {
  compile: { pathname: '/compile' },
  execute: { pathname: '/execute' },
  format: { pathname: '/format' }
};

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

export const REQUEST_COMPILE = 'REQUEST_COMPILE';
export const COMPILE_SUCCEEDED = 'COMPILE_SUCCEEDED';
export const COMPILE_FAILED = 'COMPILE_FAILED';

function requestCompile() {
  return { type: REQUEST_COMPILE };
}

function receiveCompileSuccess(json) {
  let { code, stdout, stderr } = json;
  return { type: COMPILE_SUCCEEDED, code, stdout, stderr };
}

function receiveCompileFailure(json) {
  return { type: COMPILE_FAILED, error: json.error };
}

function performCompile(target) {
  // TODO: Check a cache
  return function (dispatch, getState) {
    dispatch(requestCompile());

    const state = getState();
    const { code, configuration: { channel, mode, tests } } = state;
    const body = { channel, mode, tests, code, target };

    return jsonPost(routes.compile, body)
      .then(json => dispatch(receiveCompileSuccess(json)))
      .catch(json => dispatch(receiveCompileFailure(json)));
  };
}

export const performCompileToAssembly = () => performCompile('asm');
export const performCompileToLLVM = () => performCompile('llvm-ir');

export const EDIT_CODE = 'EDIT_CODE';

export function editCode(code) {
  return { type: EDIT_CODE, code };
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

export const REQUEST_GIST_LOAD = 'REQUEST_GIST_LOAD';
export const GIST_LOAD_SUCCEEDED = 'GIST_LOAD_SUCCEEDED';
export const GIST_LOAD_FAILED = 'GIST_LOAD_FAILED';

function requestGistLoad() {
  return { type: REQUEST_GIST_LOAD };
}

function receiveGistLoadSuccess(code) {
  return { type: GIST_LOAD_SUCCEEDED, code };
}

function receiveGistLoadFailure() {
  return { type: GIST_LOAD_FAILED };
}

export function performGistLoad(id) {
  return function (dispatch, getState) {
    dispatch(requestGistLoad());

    loadGist(id)
      .then(code => dispatch(receiveGistLoadSuccess(code)));
    // TODO: Failure case
  };
}

export const REQUEST_SAVE_TO_GIST = 'REQUEST_SAVE_TO_GIST';
export const SAVE_TO_GIST_SUCCEEDED = 'SAVE_TO_GIST_SUCCEEDED';
export const SAVE_TO_GIST_FAILED = 'SAVE_TO_GIST_FAILED';

function requestSaveToGist() {
  return { type: REQUEST_SAVE_TO_GIST };
}

function receiveSaveToGistSuccess(json) {
  const { id, url } = json;
  return { type: SAVE_TO_GIST_SUCCEEDED, id, url };
}

function receiveSaveToGistFailure(json) {
  return { type: SAVE_TO_GIST_FAILED, error: json.error };
}

export function performSaveToGist() {
  return function (dispatch, getState) {
    dispatch(requestSaveToGist());

    const { code } = getState();

    return saveGist(code)
      .then(json => dispatch(receiveSaveToGistSuccess(json)));
    // TODO: Failure case
  };
}
