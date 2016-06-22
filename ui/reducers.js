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
  default:
    return state;
  }
};

const defaultStatus = {
  building: false,
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
