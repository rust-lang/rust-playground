import { combineReducers } from 'redux';
import * as actions from './actions';
import output from './reducers/output';

export const defaultConfiguration = {
  shown: false,
  editor: "advanced",
  channel: "stable",
  mode: "debug",
  tests: false
};

const hasTests = (code) => code.includes('#[test]');
const hasMainMethod = (code) => code.includes('fn main()');
const runAsTest = (code) => hasTests(code) && !hasMainMethod(code);

const configuration = (state = defaultConfiguration, action) => {
  switch (action.type) {
  case actions.TOGGLE_CONFIGURATION:
    return { ...state, shown: !state.shown };
  case actions.CHANGE_EDITOR:
    return { ...state, editor: action.editor };
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

const defaultCode = `fn main() {
    println!("Hello, world!");
}`;

const code = (state = defaultCode, action) => {
  switch (action.type) {
  case actions.REQUEST_GIST_LOAD:
    return "";
  case actions.GIST_LOAD_SUCCEEDED:
    return action.code;

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
  case actions.REQUEST_GIST_LOAD:
    return { ...state, requestInProgress: true };
  case actions.GIST_LOAD_SUCCEEDED:
    return { ...state, requestInProgress: false };
  case actions.GIST_LOAD_FAILED:
    return { ...state, requestInProgress: false, error: "Some kind of error" };

  case actions.REQUEST_SAVE_TO_GIST:
    return { ...state, requestInProgress: true };
  case actions.SAVE_TO_GIST_SUCCEEDED: {
    let { id, url } = action;
    return { ...state, requestInProgress: false, gist: { id, url } };
  }
  case actions.SAVE_TO_GIST_FAILED:
    return { ...state, requestInProgress: false, error: "Some kind of error" };

  case actions.REQUEST_COMPILE:
    return { ...state, requestInProgress: true, error: "" };
  case actions.COMPILE_SUCCEEDED: {
    const { code = "", stdout = "", stderr = "" } = action;
    return { ...state, requestInProgress: false, code, stdout, stderr };
  }
  case actions.COMPILE_FAILED:
    return { ...state, requestInProgress: false, error: action.error };

  case actions.REQUEST_EXECUTE:
    return { ...state, requestInProgress: true, error: "" };
  case actions.EXECUTE_SUCCEEDED: {
    const { stdout = "", stderr = "" } = action;
    return { ...state, requestInProgress: false, stdout, stderr };
  }
  case actions.EXECUTE_FAILED:
    return { ...state, requestInProgress: false, error: action.error };

  case actions.REQUEST_FORMAT:
    return { ...state, requestInProgress: true, error: "" };
  case actions.FORMAT_SUCCEEDED: {
    const { stdout = "", stderr = "" } = action;
    return { ...state, requestInProgress: false, stdout, stderr };
  }
  case actions.FORMAT_FAILED:
    return { ...state, requestInProgress: false, error: action.error };

  case actions.REQUEST_CLIPPY:
    return { ...state, requestInProgress: true, error: "" };
  case actions.CLIPPY_SUCCEEDED: {
    const { stdout = "", stderr = "" } = action;
    return { ...state, requestInProgress: false, stdout, stderr};
  }
  case actions.CLIPPY_FAILED:
    return { ...state, requestInProgress: false, error: action.error };
  default:
    return state;
  }
};

const playgroundApp = combineReducers({
  configuration,
  code,
  status,
  output
});

export default playgroundApp;
