import { isEqual } from 'lodash';
import { createStore, Reducer, Store, Action, PreloadedState } from 'redux';
import { BrowserHistory, Location, Path } from 'history';
import { ThunkAction } from 'redux-thunk';

export type PlainOrThunk<St, A extends Action<any>> = A | ThunkAction<void, St, {}, A>;

// This is a... dense... attempt at saying "we accept any store with
// any dispatch so long as it can handle the actions you create". It's
// probably overly complicated, restrictive, and broad all at the same
// time.
interface CreateRouterArg<St, SubSt, A extends Action<any>> {
  store: Store<St, A> & { dispatch: (a: PlainOrThunk<St, A>) => void }; //  |
  reducer: Reducer<St>;
  history: BrowserHistory;
  stateSelector: (state: St) => SubSt;
  stateToLocation: (substate: St) => Partial<Path>;
  locationToAction: (location: Location) => PlainOrThunk<St, A> | null;
}

export interface RouterObject {
  provisionalLocation: any;
}

export function createRouter<St, SubSt, A extends Action<any>>({
  store,
  reducer,
  history,
  stateSelector,
  stateToLocation,
  locationToAction,
}: CreateRouterArg<St, SubSt, A>): RouterObject {
  let doingUpdateFromBrowser = false; // Avoid immediately PUSHing the state again
  let interestingPrevState: SubSt;

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

  const dispatchBrowserLocationChange = (nextLocation: Location) => {
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
    provisionalLocation: (makeAction: () => A) => {
      const state = store.getState();
      // This is a hack -- we know that our fully-constructed state is
      // valid as a "preloaded" state for a brand new store!
      const tempStore = createStore(reducer, state as PreloadedState<St>);
      const action = makeAction();
      tempStore.dispatch(action);
      const maybeState = tempStore.getState();
      return stateToLocation(maybeState);
    },
  };
}
