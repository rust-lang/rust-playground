import fetch from 'isomorphic-fetch';
import url from 'url';
import { load } from './gist';

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

function receiveExecuteFailure() {
  return { type: EXECUTE_FAILED };
}

function jsonPost(urlObj, body) {
  const urlStr = url.format(urlObj);

  // TODO: JSON content-type
  return fetch(urlStr, {
    method: 'post',
    body: JSON.stringify(body)
  })
    .then(response => response.json());
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
      .then(json => dispatch(receiveExecuteSuccess(json)));
    // TODO: Failure case
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

function receiveCompileFailure() {
  return { type: COMPILE_FAILED };
}

function performCompile(target) {
  // TODO: Check a cache
  return function (dispatch, getState) {
    dispatch(requestCompile());

    const state = getState();
    const { code, configuration: { channel, mode, tests } } = state;
    const body = { channel, mode, tests, code, target };

    return jsonPost(routes.compile, body)
      .then(json => dispatch(receiveCompileSuccess(json)));
    // TODO: Failure case
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

function receiveFormatFailure() {
  return { type: FORMAT_FAILED };
}

export function performFormat() {
  // TODO: Check a cache
  return function (dispatch, getState) {
    dispatch(requestFormat());

    const { code } = getState();
    const body = { code };

    return jsonPost(routes.format, body)
      .then(json => dispatch(receiveFormatSuccess(json)));
    // TODO: Failure case
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

    load(id)
      .then(code => dispatch(receiveGistLoadSuccess(code)));
    // TODO: Failure case
  };
}
