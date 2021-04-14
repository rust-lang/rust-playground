import { Action, ActionType } from '../../actions';
import { finish, start } from './sharedStateManagement';

const DEFAULT: State = {
  requestsInProgress: 0,
  success: false,
  stdout: null,
  stderr: null,
  error: null,
  wasm_js: null,
  wasm_bg: null,
};

interface State {
  requestsInProgress: number;
  success?: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  wasm_js?: string;
  wasm_bg?: string;
}

export default function wasmPack(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.CompileWasmPackRequest:
      return start(DEFAULT, state);
    case ActionType.CompileWasmPackSucceeded: {
      const { stdout = '', stderr = '', wasm_js = '', wasm_bg = '', success = false } = action;
      return finish(state, { stdout, stderr, wasm_js, wasm_bg, success });
    }
    case ActionType.CompileWasmPackFailed:
      return finish(state, { error: action.error });
    default:
      return state;
  }
}
