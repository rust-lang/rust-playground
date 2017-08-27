import * as actions from '../../actions';

const DEFAULT: State = {
  focus: null,
};

type Focus = 'clippy' | 'llvm-ir' | 'mir' | 'asm' | 'execute' | 'format' | 'gist';

export interface State {
  focus?: Focus,
};

export default function meta(state = DEFAULT, action) {
  switch (action.type) {
  case actions.ActionType.ChangeFocus:
    return { ...state, focus: action.focus };

  case actions.REQUEST_CLIPPY:
    return { ...state, focus: 'clippy' };

  case actions.REQUEST_COMPILE_LLVM_IR:
    return { ...state, focus: 'llvm-ir' };

  case actions.REQUEST_COMPILE_MIR:
    return { ...state, focus: 'mir' };

  case actions.REQUEST_COMPILE_ASSEMBLY:
    return { ...state, focus: 'asm' };

  case actions.ActionType.ExecuteRequest:
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
}
