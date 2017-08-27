import * as actions from '../actions';

const DEFAULT = `fn main() {
    println!("Hello, world!");
}`;

export default function code(state = DEFAULT, action) {
  switch (action.type) {
  case actions.REQUEST_GIST_LOAD:
    return "";
  case actions.GIST_LOAD_SUCCEEDED:
    return action.code;

  case actions.EDIT_CODE:
    return action.code;

  case actions.FORMAT_SUCCEEDED:
    return action.code;

  default:
    return state;
  }
}
