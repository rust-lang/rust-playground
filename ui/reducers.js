import * as actions from './actions';

const playgroundApp = (state = { building: false, error: false }, action) => {
  switch (action.type) {
  case actions.REQUEST_BUILD:
    return { ...state, building: true, error: false };
  case actions.BUILD_SUCCEEDED:
    return { ...state, building: false, error: false, code: action.output };
  case actions.REQUEST_BUILD:
    return { ...state, building: false, error: true };
  case actions.EDIT_CODE:
    return { ...state, code: action.code };
  default:
    return state;
  }
};

export default playgroundApp;
