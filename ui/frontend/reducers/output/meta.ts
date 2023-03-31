import { Action, ActionType } from '../../actions';
import { Focus } from '../../types';
import { performGistLoad, performGistSave } from './gist';
import { performFormat } from './format';
import { performExecute, wsExecuteRequest } from './execute';

const DEFAULT: State = {
};

interface State {
  focus?: Focus;
}

export default function meta(state = DEFAULT, action: Action) {
  switch (action.type) {
    case ActionType.ChangeFocus:
      return { ...state, focus: action.focus };

    case ActionType.RequestClippy:
      return { ...state, focus: Focus.Clippy };

    case ActionType.RequestMiri:
      return { ...state, focus: Focus.Miri };

    case ActionType.RequestMacroExpansion:
      return { ...state, focus: Focus.MacroExpansion };

    case ActionType.CompileLlvmIrRequest:
      return { ...state, focus: Focus.LlvmIr };

    case ActionType.CompileMirRequest:
      return { ...state, focus: Focus.Mir };

    case ActionType.CompileHirRequest:
      return { ...state, focus: Focus.Hir };

    case ActionType.CompileWasmRequest:
      return { ...state, focus: Focus.Wasm };

    case ActionType.CompileAssemblyRequest:
      return { ...state, focus: Focus.Asm };

    case performExecute.pending.type:
    case wsExecuteRequest.type:
      return { ...state, focus: Focus.Execute };

    default: {
      if (performGistLoad.pending.match(action) || performGistSave.pending.match(action)) {
        return { ...state, focus: Focus.Gist };
      } else if (performFormat.pending.match(action)) {
        return { ...state, focus: Focus.Format };
      } else if (performFormat.fulfilled.match(action)) {
        return { ...state, focus: undefined };
      } else {
        return state;
      }
    }
  }
}
