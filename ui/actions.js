import fetch from 'isomorphic-fetch';
import url from 'url';

export const CHANGE_CHANNEL = 'CHANGE_CHANNEL';

export function changeChannel(channel) {
  return { type: CHANGE_CHANNEL, channel };
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
    const { code, configuration: { channel } } = state;

    return fetch(compileUrl, {
      method: 'post',
      body: JSON.stringify({
        channel,
        code
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
