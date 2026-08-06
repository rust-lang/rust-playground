import { createListenerMiddleware } from '@reduxjs/toolkit';

import { AppDispatch } from './configureStore';
import { State } from './reducers';
import { updateAnalysis } from './reducers/codeAnalysis';
import { buildAnalyzer } from './rustCodeAnalyzer';
import { SINGLE_FILE_ID } from './selectors';
import { FileId } from './types';

const performAnalysisPromise = buildAnalyzer();
let lastState: State | undefined = undefined;

export const analyzer = createListenerMiddleware();

const startAppListening = analyzer.startListening.withTypes<State, AppDispatch>();

const findChanges = (currentState: State, lastState: State | undefined): Map<FileId, string> => {
  const result = new Map();

  // Check to see if we've done any analysis at all, e.g. when
  // the app boots.
  if (!lastState || Object.keys(currentState.codeAnalysis).length === 0) {
    result.set(SINGLE_FILE_ID, currentState.code);
    for (const currentFile of currentState.files.files) {
      result.set(currentFile.id, currentFile.content);
    }

    return result;
  }

  if (currentState.code !== lastState.code) {
    result.set(SINGLE_FILE_ID, currentState.code);
  }

  for (const currentFile of currentState.files.files) {
    const originalFile = lastState.files.files.find((f) => f.id === currentFile.id);
    if (!originalFile || currentFile.content !== originalFile.content) {
      result.set(currentFile.id, currentFile.content);
    }
  }

  return result;
};

// Watch for requests changing the code, then analyze them for
// properties like if they contain a main function.
//
// This is potentially a bit wasteful as we always run the analysis,
// even if nothing is looking at the results.
startAppListening({
  predicate: (action) => !updateAnalysis.match(action),

  effect: async (_action, listenerApi) => {
    // Stop previous workers from completing if a second one starts.
    listenerApi.cancelActiveListeners();

    const currentState = listenerApi.getState();
    const changes = findChanges(currentState, lastState);

    if (changes.size === 0) {
      return;
    }

    const performAnalysis = await listenerApi.pause(performAnalysisPromise);

    const actions = changes
      .entries()
      .map(([id, content]) => ({ id, analysis: performAnalysis(content) }));

    // Check to see if another action has come in since we started and
    // defer to that one.
    listenerApi.throwIfCancelled();

    // Commit the analysis and what state was analyzed.
    listenerApi.dispatch(updateAnalysis(Array.from(actions)));
    lastState = currentState;
  },
});
