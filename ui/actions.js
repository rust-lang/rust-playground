import fetch from 'isomorphic-fetch';
import url from 'url';

export const CHANGE_CHANNEL = 'CHANGE_CHANNEL';
export const CHANGE_MODE = 'CHANGE_MODE';

export function changeChannel(channel) {
  return { type: CHANGE_CHANNEL, channel };
}

export function changeMode(mode) {
  return { type: CHANGE_MODE, mode };
}

export const REQUEST_BUILD = 'REQUEST_BUILD';
export const BUILD_SUCCEEDED = 'BUILD_SUCCEEDED';
export const BUILD_FAILED = 'BUILD_FAILED';

function requestBuild() {
  return { type: REQUEST_BUILD };
}

function receiveBuildSuccess(json) {
  return { type: BUILD_SUCCEEDED, stdout: json.stdout, stderr: json.stderr };
}

function receiveBuildFailure() {
  return { type: BUILD_FAILED };
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
  format: { pathname: '/format' }
};

export function performBuild() {
  // TODO: Check a cache
  return function (dispatch, getState) {
    dispatch(requestBuild());

    const state = getState();
    const { code, configuration: { channel, mode, tests } } = state;
    const body = { channel, mode, tests, code };

    return jsonPost(routes.compile, body)
      .then(json => dispatch(receiveBuildSuccess(json)));
    // TODO: Failure case
  };
}

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
