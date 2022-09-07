import { isEqual } from 'lodash-es';
import { configureStore, CombinedState, ThunkAction, Reducer, Store, Action, PreloadedState } from '@reduxjs/toolkit';
import { BrowserHistory, Location, Path } from 'history';

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
  let interestingPrevState: SubSt;

  // Watch changes to the Redux state
  store.subscribe(() => {
    const nextState = store.getState();

    // It's only worth checking if our state subset has changed.
    const interestingNextState = stateSelector(nextState);
    if (isEqual(interestingNextState, interestingPrevState)) { return; }
    interestingPrevState = interestingNextState;

    // If our next location matches where we already are, leave the
    // history stack as-is.
    const nextLocation = stateToLocation(nextState);
    if (pathsEqualEnough(history, history.location, nextLocation)) { return; }
    history.push(nextLocation);
  });

  const dispatchBrowserLocationChange = (nextLocation: Location) => {
    const action = locationToAction(nextLocation);
    if (action) {
      store.dispatch(action);
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

  return {
    provisionalLocation: (makeAction: () => A) => {
      const state = store.getState();

      const tempStore = configureStore({
        reducer,
        // This is a hack -- we know that our fully-constructed state is
        // valid as a "preloaded" state for a brand new store!
        preloadedState: state as PreloadedState<CombinedState<St>>,
        devTools: false,
      });

      const action = makeAction();
      tempStore.dispatch(action);
      const maybeState = tempStore.getState();
      return stateToLocation(maybeState);
    },
  };
}

function pathsEqualEnough(history: BrowserHistory, a: Partial<Path>, b: Partial<Path>): boolean {
  const aHref = history.createHref(a);
  const bHref = history.createHref(b);

  return aHref === bHref;
}
