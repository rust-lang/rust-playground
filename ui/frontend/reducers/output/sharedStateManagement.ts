export function start(zeroState, state) {
  const { requestsInProgress } = state;
  return { ...zeroState, requestsInProgress: requestsInProgress + 1 };
}

export function finish(state, newState = {}) {
  const { requestsInProgress } = state;
  return { ...state, ...newState, requestsInProgress: requestsInProgress - 1 };
}
