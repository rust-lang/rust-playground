import { combineReducers } from 'redux';
import * as actions from '../actions';

const defaultMeta = {
  focus: null,
};

const meta = (state = defaultMeta, action) => {
  switch (action.type) {
  case actions.CHANGE_FOCUS:
    return { ...state, focus: action.focus };

  case actions.REQUEST_CLIPPY:
    return { ...state, focus: 'clippy' };

  case actions.REQUEST_COMPILE_LLVM_IR:
    return { ...state, focus: 'llvm-ir' };

  case actions.REQUEST_COMPILE_MIR:
    return { ...state, focus: 'mir' };

  case actions.REQUEST_COMPILE_ASSEMBLY:
    return { ...state, focus: 'asm' };

  case actions.REQUEST_EXECUTE:
    return { ...state, focus: 'execute' };

  case actions.REQUEST_FORMAT:
    return { ...state, focus: 'format' };
  case actions.FORMAT_SUCCEEDED:
  case actions.FORMAT_FAILED:
    return { ...state, focus: null };

  case actions.REQUEST_GIST_LOAD:
  case actions.REQUEST_GIST_SAVE:
    return { ...state, focus: 'gist' };

  default:
    return state;
  }
};

function start(zeroState, state) {
  const { requestsInProgress } = state;
  return { ...zeroState, requestsInProgress: requestsInProgress + 1 };
}

function finish(state, newState = {}) {
  const { requestsInProgress } = state;
  return { ...state, ...newState, requestsInProgress: requestsInProgress - 1 };
}

const defaultFormat = {
  requestsInProgress: 0,
};

const format = (state = defaultFormat, action) => {
  switch (action.type) {
  case actions.REQUEST_FORMAT:
    return start(defaultFormat, state);
  case actions.FORMAT_SUCCEEDED:
  case actions.FORMAT_FAILED:
    return finish(state);
  default:
    return state;
  }
};

const defaultClippy = {
  requestsInProgress: 0,
  stdout: null,
  stderr: null,
  error: null,
};

const clippy = (state = defaultClippy, action) => {
  switch (action.type) {
  case actions.REQUEST_CLIPPY:
    return start(defaultClippy, state);
  case actions.CLIPPY_SUCCEEDED: {
    const { stdout = "", stderr = "" } = action;
    return finish(state, { stdout, stderr });
  }
  case actions.CLIPPY_FAILED:
    return finish(state, { error: action.error });
  default:
    return state;
  }
};

const defaultAssembly = {
  requestsInProgress: 0,
  code: null,
  stdout: null,
  stderr: null,
  error: null,
};

const assembly = (state = defaultAssembly, action) => {
  switch (action.type) {
  case actions.REQUEST_COMPILE_ASSEMBLY:
    return start(defaultAssembly, state);
  case actions.COMPILE_ASSEMBLY_SUCCEEDED: {
    const { code = "", stdout = "", stderr = "" } = action;
    return finish(state, { code, stdout, stderr });
  }
  case actions.COMPILE_ASSEMBLY_FAILED:
    return finish(state, { error: action.error });
  default:
    return state;
  }
};

const defaultLlvmIr = {
  requestsInProgress: 0,
  code: null,
  stdout: null,
  stderr: null,
  error: null,
};

const llvmIr = (state = defaultLlvmIr, action) => {
  switch (action.type) {
  case actions.REQUEST_COMPILE_LLVM_IR:
    return start(defaultLlvmIr, state);
  case actions.COMPILE_LLVM_IR_SUCCEEDED: {
    const { code = "", stdout = "", stderr = "" } = action;
    return finish(state, { code, stdout, stderr });
  }
  case actions.COMPILE_LLVM_IR_FAILED:
    return finish(state, { error: action.error });
  default:
    return state;
  }
};

const defaultMir = {
  requestsInProgress: 0,
  code: null,
  stdout: null,
  stderr: null,
  error: null,
};

const mir = (state = defaultMir, action) => {
  switch (action.type) {
  case actions.REQUEST_COMPILE_MIR:
    return start(defaultMir, state);
  case actions.COMPILE_MIR_SUCCEEDED: {
    const { code = "", stdout = "", stderr = "" } = action;
    return finish(state, { code, stdout, stderr });
  }
  case actions.COMPILE_MIR_FAILED:
    return finish(state, { error: action.error });
  default:
    return state;
  }
};

const defaultExecute = {
  requestsInProgress: 0,
  stdout: null,
  stderr: null,
  error: null,
};

const execute = (state = defaultExecute, action) => {
  switch (action.type) {
  case actions.REQUEST_EXECUTE:
    return start(defaultExecute, state);
  case actions.EXECUTE_SUCCEEDED: {
    const { stdout = "", stderr = "" } = action;
    return finish(state, { stdout, stderr });
  }
  case actions.EXECUTE_FAILED:
    return finish(state, { error: action.error });
  default:
    return state;
  }
};

const defaultGist = {
  requestsInProgress: 0,
  id: null,
  url: null,
  error: null,
};

const gist = (state = defaultGist, action) => {
  switch (action.type) {
  case actions.REQUEST_GIST_LOAD:
  case actions.REQUEST_GIST_SAVE:
    return start(defaultGist, state);

  case actions.GIST_LOAD_SUCCEEDED:
  case actions.GIST_SAVE_SUCCEEDED: {
    const { id, url, channel } = action;
    return finish(state, { id, url, channel });
  }

  case actions.GIST_LOAD_FAILED:
  case actions.GIST_SAVE_FAILED:
    return finish(state, { error: "Some kind of error" });

  default:
    return state;
  }
};

const output = combineReducers({
  meta,
  format,
  clippy,
  assembly,
  llvmIr,
  mir,
  execute,
  gist,
});

export default output;
