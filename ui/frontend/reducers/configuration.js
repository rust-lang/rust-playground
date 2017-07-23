import * as actions from '../actions';

export const DEFAULT = {
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

export default function configuration(state = DEFAULT, action) {
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
}
