import { combineReducers } from 'redux';
import * as actions from './actions';

const defaultConfiguration = {
  channel: "stable",
  mode: "debug",
  tests: false
};

const hasTests = (code) => code.includes('#[test]');
const hasMainMethod = (code) => code.includes('fn main()');
const runAsTest = (code) => hasTests(code) && !hasMainMethod(code);

const configuration = (state = defaultConfiguration, action) => {
  switch (action.type) {
  case actions.CHANGE_CHANNEL:
    return { ...state, channel: action.channel };
  case actions.CHANGE_MODE:
    return { ...state, mode: action.mode };
  case actions.EDIT_CODE:
    return { ...state, tests: runAsTest(action.code) };
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
  requestInProgress: false,
  error: "",
  code: "",
  stdout: "",
  stderr: ""
};

const status = (state = defaultStatus, action) => {
  switch (action.type) {
  case actions.REQUEST_COMPILE:
    return { ...state, requestInProgress: true, error: "" };
  case actions.COMPILE_SUCCEEDED:
    const { code = "", stdout = "", stderr = "" } = action;
    return { ...state, requestInProgress: false, code, stdout, stderr };
  case actions.COMPILE_FAILED:
    return { ...state, requestInProgress: false, error: "Some kind of error" };

  case actions.REQUEST_EXECUTE:
    return { ...state, requestInProgress: true, error: "" };
  case actions.EXECUTE_SUCCEEDED:
    return { ...state, requestInProgress: false, stdout: action.stdout || "", stderr: action.stderr || ""};
  case actions.EXECUTE_FAILED:
    return { ...state, requestInProgress: false, error: "Some kind of error" };

  case actions.REQUEST_FORMAT:
    return { ...state, requestInProgress: true, error: "" };
  case actions.FORMAT_SUCCEEDED:
    return { ...state, requestInProgress: false, stdout: action.stdout || "", stderr: action.stderr || "" };
  case actions.FORMAT_FAILED:
    return { ...state, requestInProgress: false, error: "Some kind of error" };
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
