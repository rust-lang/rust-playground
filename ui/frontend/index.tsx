import 'core-js';

import 'normalize.css/normalize.css';
import './index.module.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { v4 } from 'uuid';

import {
  editCode,
  enableFeatureGate,
  gotoPosition,
  selectText,
  addImport,
  performCratesLoad,
  performVersionsLoad,
  reExecuteWithBacktrace,
  browserWidthChanged,
} from './actions';
import { configureRustErrors } from './highlighting';
import PageSwitcher from './PageSwitcher';
import playgroundApp from './reducers';
import { clientSetIdentifiers } from './reducers/client';
import { featureFlagsForceDisableAll, featureFlagsForceEnableAll } from './reducers/featureFlags';
import { disableSyncChangesToStorage } from './reducers/globalConfiguration';
import Router from './Router';
import configureStore from './configureStore';

const store = configureStore(window);

if (store.getState().client.id === '') {
  const { crypto } = window;

  const id = v4();

  const rawValue = new Uint32Array(1);
  crypto.getRandomValues(rawValue);
  const featureFlagThreshold = rawValue[0] / 0xFFFF_FFFF;

  store.dispatch(clientSetIdentifiers({ id, featureFlagThreshold }));
}

const params = new URLSearchParams(window.location.search);
if (params.has('features')) {
  const selection = params.get('features');
  if (selection === 'false') {
    store.dispatch(featureFlagsForceDisableAll());
  } else {
    store.dispatch(featureFlagsForceEnableAll());
  }
}

const whenBrowserWidthChanged = (evt: MediaQueryList | MediaQueryListEvent) =>
  store.dispatch(browserWidthChanged(evt.matches));
const maxWidthMediaQuery = window.matchMedia('(max-width: 1600px)');

whenBrowserWidthChanged(maxWidthMediaQuery);
maxWidthMediaQuery.addEventListener('change', whenBrowserWidthChanged);

configureRustErrors({
  enableFeatureGate: featureGate => store.dispatch(enableFeatureGate(featureGate)),
  gotoPosition: (line, col) => store.dispatch(gotoPosition(line, col)),
  selectText: (start, end) => store.dispatch(selectText(start, end)),
  addImport: (code) => store.dispatch(addImport(code)),
  reExecuteWithBacktrace: () => store.dispatch(reExecuteWithBacktrace()),
  getChannel: () => store.getState().configuration.channel,
});

store.dispatch(performCratesLoad());
store.dispatch(performVersionsLoad());

window.rustPlayground = {
  setCode: code => {
    store.dispatch(editCode(code));
  },
  disableSyncChangesToStorage: () => {
    store.dispatch(disableSyncChangesToStorage());
  },
};

const container = document.getElementById('playground');
if (container) {
  const root = createRoot(container);
  root.render(
    <Provider store={store}>
      <Router store={store} reducer={playgroundApp}>
        <PageSwitcher />
      </Router>
    </Provider>,
  );
}
