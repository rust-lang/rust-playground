import { isEqual } from 'lodash';
import { createStore } from 'redux';

export function createRouter({
  store,
  reducer,
  history,
  stateSelector,
  stateToLocation,
  locationToAction,
}) {
  let doingUpdateFromBrowser = false; // Avoid immediately PUSHing the state again
  let interestingPrevState;

  // Watch changes to the Redux state
  store.subscribe(() => {
    if (doingUpdateFromBrowser) { return; }

    const nextState = store.getState();
    const interestingNextState = stateSelector(nextState);

    if (!isEqual(interestingNextState, interestingPrevState)) {
      const nextLocation = stateToLocation(nextState);

      history.push(nextLocation);

      interestingPrevState = interestingNextState;
    }
  });

  const dispatchBrowserLocationChange = nextLocation => {
    const action = locationToAction(nextLocation);
    if (action) {
      doingUpdateFromBrowser = true;
      store.dispatch(action);
      doingUpdateFromBrowser = false;
    }
  };

  // Watch changes to the browser state
  history.listen(({ action, location }) => {
    if (action === 'POP') {
      dispatchBrowserLocationChange(location);
    }
  });

  // Load initial browser state
  dispatchBrowserLocationChange(history.location);

  // Now that we've set up any initial state, we keep it so we can
  // tell when the location needs to change.
  interestingPrevState = stateSelector(store.getState());

  return {
    provisionalLocation: action => {
      const state = store.getState();
      const tempStore = createStore(reducer, state);
      const a = action();
      tempStore.dispatch(a);
      const maybeState = tempStore.getState();
      return stateToLocation(maybeState);
    },
  };
}
