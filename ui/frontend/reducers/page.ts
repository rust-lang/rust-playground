import * as actions from '../actions';

export type State = "index" | "help";

export default function page(state: State = "index", action) {
  switch (action.type) {
  case actions.SET_PAGE:
    return action.page;
  default:
    return state;
  }
}
