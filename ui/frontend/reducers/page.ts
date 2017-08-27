import * as actions from '../actions';

export default function page(state = "index", action) {
  switch (action.type) {
  case actions.SET_PAGE:
    return action.page;

  default:
    return state;
  }
}
