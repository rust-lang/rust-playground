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

// TODO: Check a cache

export function performBuild() {
  return function (dispatch, getState) {
    dispatch(requestBuild());

    // TODO: Un-hardcode URL
    const compileUrl = url.format({ pathname: '/compile' });

    const state = getState();
    const { code, configuration: { channel, mode } } = state;

    return fetch(compileUrl, {
      method: 'post',
      body: JSON.stringify({
        channel,
        code,
        mode
      })
    })
      .then(response => response.json())
      .then(json => dispatch(receiveBuildSuccess(json)));
    // TODO: JSON content-type
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
  return function (dispatch, getState) {
    dispatch(requestFormat());

    // TODO: Un-hardcode URL
    const formatUrl = url.format({ pathname: '/format' });

    const state = getState();
    const { code } = state;

    return fetch(formatUrl, {
      method: 'post',
      body: JSON.stringify({
        code
      })
    })
      .then(response => response.json())
      .then(json => dispatch(receiveFormatSuccess(json)));
    // TODO: JSON content-type
    // TODO: Failure case
  };
}
