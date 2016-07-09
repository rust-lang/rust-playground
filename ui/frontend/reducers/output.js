import { combineReducers } from 'redux';
import * as actions from '../actions';

const defaultMeta = {
  requestsInProgress: 0,
  focus: null
};

const meta = (state = defaultMeta, action) => {
  const start = () =>
          ({ ...state, requestsInProgress: state.requestsInProgress + 1 });

  const finish = () =>
          ({ ...state, requestsInProgress: state.requestsInProgress - 1 });

  const finishAndFocus = (focus) =>
          ({ ...finish(), focus });

  switch (action.type) {
  case actions.CHANGE_FOCUS:
    return { ...state, focus: action.focus };

  case actions.REQUEST_CLIPPY:
  case actions.REQUEST_COMPILE_LLVM_IR:
  case actions.REQUEST_COMPILE_ASSEMBLY:
  case actions.REQUEST_EXECUTE:
  case actions.REQUEST_FORMAT:
  case actions.REQUEST_GIST_LOAD:
  case actions.REQUEST_SAVE_TO_GIST:
    return start();

  case actions.CLIPPY_FAILED:
  case actions.CLIPPY_SUCCEEDED:
    return finishAndFocus('clippy');

  case actions.COMPILE_LLVM_IR_FAILED:
  case actions.COMPILE_LLVM_IR_SUCCEEDED:
    return finishAndFocus('llvm-ir');

  case actions.COMPILE_ASSEMBLY_FAILED:
  case actions.COMPILE_ASSEMBLY_SUCCEEDED:
    return finishAndFocus('asm');

  case actions.EXECUTE_FAILED:
  case actions.EXECUTE_SUCCEEDED:
    return finishAndFocus('execute');

  case actions.FORMAT_FAILED:
  case actions.FORMAT_SUCCEEDED:
    return finish();

  case actions.GIST_LOAD_FAILED:
  case actions.GIST_LOAD_SUCCEEDED:
    return finish();

  case actions.SAVE_TO_GIST_FAILED:
  case actions.SAVE_TO_GIST_SUCCEEDED:
    return finishAndFocus('gist');

  default:
    return state;
  }
};

const defaultClippy = {
  stdout: null,
  stderr: null,
  error: null
};

const clippy = (state = defaultClippy, action) => {
  switch (action.type) {
  case actions.REQUEST_CLIPPY:
    return defaultClippy;
  case actions.CLIPPY_SUCCEEDED: {
    const { stdout = "", stderr = "" } = action;
    return { ...state, stdout, stderr };
  }
  case actions.CLIPPY_FAILED:
    return { ...state, error: action.error };
  default:
    return state;
  }
};

const defaultLlvmIr = {
  code: null,
  stdout: null,
  stderr: null,
  error: null
};

const llvmIr = (state = defaultLlvmIr, action) => {
  switch (action.type) {
  case actions.REQUEST_COMPILE_LLVM_IR:
    return defaultLlvmIr;
  case actions.COMPILE_LLVM_IR_SUCCEEDED: {
    const { code = "", stdout = "", stderr = "" } = action;
    return { ...state, code, stdout, stderr };
  }
  case actions.COMPILE_LLVM_IR_FAILED:
    return { ...state, error: action.error };
  default:
    return state;
  }
};

const defaultAssembly = {
  code: null,
  stdout: null,
  stderr: null,
  error: null
};

const assembly = (state = defaultAssembly, action) => {
  switch (action.type) {
  case actions.REQUEST_COMPILE_ASSEMBLY:
    return defaultAssembly;
  case actions.COMPILE_ASSEMBLY_SUCCEEDED: {
    const { code = "", stdout = "", stderr = "" } = action;
    return { ...state, code, stdout, stderr };
  }
  case actions.COMPILE_ASSEMBLY_FAILED:
    return { ...state, error: action.error };
  default:
    return state;
  }
};

const defaultExecute = {
  stdout: null,
  stderr: null,
  error: null
};

const execute = (state = defaultExecute, action) => {
  switch (action.type) {
  case actions.REQUEST_EXECUTE:
    return defaultExecute;
  case actions.EXECUTE_SUCCEEDED: {
    const { stdout = "", stderr = "" } = action;
    return { ...state, stdout, stderr };
  }
  case actions.EXECUTE_FAILED:
    return { ...state, error: action.error };
  default:
    return state;
  }
};

const defaultGist = {
  id: null,
  url: null,
  error: null
};

const gist = (state = defaultGist, action) => {
  switch (action.type) {
  case actions.REQUEST_GIST:
    return defaultGist;
  case actions.SAVE_TO_GIST_SUCCEEDED: {
    let { id, url } = action;
    return { ...state, id, url };
  }
  case actions.SAVE_TO_GIST_FAILED:
    return { ...state, error: "Some kind of error" };
  case actions.GIST_LOAD_SUCCEEDED: {
    const { id, url } = action;
    return { ...state, id, url };
  }
  default:
    return state;
  }
};

const output = combineReducers({
  meta,
  clippy,
  assembly,
  llvmIr,
  execute,
  gist
});

export default output;
