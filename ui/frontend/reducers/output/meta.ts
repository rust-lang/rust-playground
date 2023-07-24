import { Action, ActionType } from '../../actions';
import { Focus } from '../../types';
import { performGistLoad, performGistSave } from './gist';
import { performFormat } from './format';
import { performExecute, wsExecuteRequest } from './execute';
import { performCompileAssembly } from './assembly';
import { performCompileHir } from './hir';
import { performCompileLlvmIr } from './llvmIr';
import { performCompileMir } from './mir';
import { performCompileWasm } from './wasm';

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

    case performExecute.pending.type:
    case wsExecuteRequest.type:
      return { ...state, focus: Focus.Execute };

    case performCompileAssembly.pending.type:
      return { ...state, focus: Focus.Asm };

    case performCompileHir.pending.type:
      return { ...state, focus: Focus.Hir };

    case performCompileLlvmIr.pending.type:
      return { ...state, focus: Focus.LlvmIr };

    case performCompileMir.pending.type:
      return { ...state, focus: Focus.Mir };

    case performCompileWasm.pending.type:
      return { ...state, focus: Focus.Wasm };

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
