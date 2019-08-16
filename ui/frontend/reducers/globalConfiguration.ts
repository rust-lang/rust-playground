import { Action } from '../actions';

export interface State {
  baseUrl: string;
}

const DEFAULT: State = {
  baseUrl: '',
};

export default function globalConfiguration(state = DEFAULT, _action: Action): State {
  return state;
}
