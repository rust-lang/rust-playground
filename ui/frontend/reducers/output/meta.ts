import { Action, ActionType } from '../../actions';

const DEFAULT: State = {
  focus: null,
};

export type Focus = 'clippy' | 'llvm-ir' | 'mir' | 'wasm' | 'asm' | 'execute' | 'format' | 'gist';

export interface State {
  focus?: Focus;
}

export default function meta(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.ChangeFocus:
      return { ...state, focus: action.focus };

    case ActionType.RequestClippy:
      return { ...state, focus: 'clippy' };

    case ActionType.CompileLlvmIrRequest:
      return { ...state, focus: 'llvm-ir' };

    case ActionType.CompileMirRequest:
      return { ...state, focus: 'mir' };

    case ActionType.CompileWasmRequest:
      return { ...state, focus: 'wasm' };

    case ActionType.CompileAssemblyRequest:
      return { ...state, focus: 'asm' };

    case ActionType.ExecuteRequest:
      return { ...state, focus: 'execute' };

    case ActionType.RequestFormat:
      return { ...state, focus: 'format' };
    case ActionType.FormatSucceeded:
    case ActionType.FormatFailed:
      return { ...state, focus: null };

    case ActionType.RequestGistLoad:
    case ActionType.RequestGistSave:
      return { ...state, focus: 'gist' };

    default:
      return state;
  }
}
