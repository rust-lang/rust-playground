export interface RequestsInProgress {
  requestsInProgress: number;
}

type WithoutRequests<S> = Pick<S, Exclude<keyof S, keyof RequestsInProgress>>;

export function start<S extends RequestsInProgress>(
  zeroState: S,
  state: S,
): S {
  const { requestsInProgress = 0 } = state;
  return Object.assign({}, zeroState, { requestsInProgress: requestsInProgress + 1 });
}

export function finish<S extends RequestsInProgress>(
  state: S,
  newState?: WithoutRequests<S>,
): S {
  const { requestsInProgress = 0 } = state;
  return Object.assign({}, state, newState, { requestsInProgress: requestsInProgress - 1 });
}
