import { combineReducers } from 'redux';
import * as actions from './actions';

const defaultConfiguration = {
  channel: "stable"
};

const configuration = (state = defaultConfiguration, action) => {
  switch (action.type) {
  case actions.CHANGE_CHANNEL:
    return { ...state, channel: action.channel };
  default:
    return state;
  }
};

const code = (state = "", action) => {
  switch (action.type) {
  case actions.EDIT_CODE:
    return action.code;
  case actions.FORMAT_SUCCEEDED:
    return action.code;
  default:
    return state;
  }
};

const defaultStatus = {
  building: false, // TODO: rename to progress or something
  error: "",
  stdout: "",
  stderr: ""
};

const status = (state = defaultStatus, action) => {
  switch (action.type) {
  case actions.REQUEST_BUILD:
    return { ...state, building: true, error: "" };
  case actions.BUILD_SUCCEEDED:
    return { ...state, building: false, stdout: action.stdout, stderr: action.stderr };
  case actions.BUILD_FAILED:
    return { ...state, building: false, error: "Some kind of error" };
  case actions.REQUEST_FORMAT:
    return { ...state, building: true, error: "" };
  case actions.FORMAT_SUCCEEDED:
    return { ...state, building: false, stdout: action.stdout, stderr: action.stderr };
  case actions.FORMAT_FAILED:
    return { ...state, building: false, error: "Some kind of error" };
  default:
    return state;
  }
};

const playgroundApp = combineReducers({
  configuration,
  code,
  status
});

export default playgroundApp;
