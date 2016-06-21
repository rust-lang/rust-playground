import * as actions from './actions';

const defaultState = {
  building: false,
  error: false,
  code: "",
  output: ""
};

const playgroundApp = (state = defaultState, action) => {
  switch (action.type) {
  case actions.REQUEST_BUILD:
    return { ...state, building: true, error: false };
  case actions.BUILD_SUCCEEDED:
    return { ...state, building: false, error: false, output: action.output };
  case actions.REQUEST_BUILD:
    return { ...state, building: false, error: true };
  case actions.EDIT_CODE:
    return { ...state, code: action.code };
  default:
    return state;
  }
};

export default playgroundApp;
