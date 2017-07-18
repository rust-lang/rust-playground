import { combineReducers } from 'redux';
import * as actions from './actions';
import output from './reducers/output';

export const defaultConfiguration = {
  shown: false,
  editor: "advanced",
  keybinding: "ace",
  theme: "github",
  orientation: "automatic",
  assemblyFlavor: "att",
  channel: "stable",
  mode: "debug",
  crateType: "bin",
  tests: false,
};

const hasTests = code => code.includes('#[test]');
const hasMainMethod = code => code.includes('fn main()');
const runAsTest = code => hasTests(code) && !hasMainMethod(code);

const CRATE_TYPE_RE = /^\s*#!\s*\[\s*crate_type\s*=\s*"([^"]*)"\s*]/m;
const crateType = code => (code.match(CRATE_TYPE_RE) || [null, 'bin'])[1];

const configuration = (state = defaultConfiguration, action) => {
  switch (action.type) {
  case actions.TOGGLE_CONFIGURATION:
    return { ...state, shown: !state.shown };
  case actions.CHANGE_EDITOR:
    return { ...state, editor: action.editor };
  case actions.CHANGE_KEYBINDING:
    return { ...state, keybinding: action.keybinding };
  case actions.CHANGE_THEME:
    return { ...state, theme: action.theme };
  case actions.CHANGE_ORIENTATION:
    return { ...state, orientation: action.orientation };
  case actions.CHANGE_ASSEMBLY_FLAVOR:
    return { ...state, assemblyFlavor: action.assemblyFlavor };
  case actions.CHANGE_CHANNEL: {
    const { channel } = action;
    if (["stable", "beta", "nightly"].includes(channel)) {
      return { ...state, channel };
    } else {
      return state;
    }
  }
  case actions.CHANGE_MODE:
    return { ...state, mode: action.mode };
  case actions.EDIT_CODE: {
    const { code } = action;
    return { ...state, crateType: crateType(code), tests: runAsTest(code) };
  }
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

const defaultPosition = {
  line: 0,
  column: 0,
};

const position = (state = defaultPosition, action) => {
  switch (action.type) {
  case actions.GOTO_POSITION: {
    const { line, column } = action;
    return { ...state, line, column };
  }
  default:
    return state;
  }
};

const page = (state = "index", action) => {
  switch (action.type) {
  case actions.SET_PAGE:
    return action.page;

  default:
    return state;
  }
};

const playgroundApp = combineReducers({
  configuration,
  code,
  position,
  output,
  page,
});

export default playgroundApp;
