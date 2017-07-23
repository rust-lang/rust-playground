import * as actions from '../../actions';
import { start, finish } from './sharedStateManagement';

const DEFAULT = {
  requestsInProgress: 0,
  code: null,
  stdout: null,
  stderr: null,
  error: null,
};

export default function llvmIr(state = DEFAULT, action) {
  switch (action.type) {
  case actions.REQUEST_COMPILE_LLVM_IR:
    return start(DEFAULT, state);
  case actions.COMPILE_LLVM_IR_SUCCEEDED: {
    const { code = "", stdout = "", stderr = "" } = action;
    return finish(state, { code, stdout, stderr });
  }
  case actions.COMPILE_LLVM_IR_FAILED:
    return finish(state, { error: action.error });
  default:
    return state;
  }
}
