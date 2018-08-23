import { DEFAULT as defaultCode } from './reducers/code';
import { DEFAULT as defaultConfiguration } from './reducers/configuration';
import { DEFAULT as defaultNotifications } from './reducers/notifications';

import State from './state';

const CURRENT_VERSION = 1;

export function serialize(state: State) {
  return JSON.stringify({
    version: CURRENT_VERSION,
    configuration: {
      editor: state.configuration.editor,
      keybinding: state.configuration.keybinding,
      theme: state.configuration.theme,
      orientation: state.configuration.orientation,
      assemblyFlavor: state.configuration.assemblyFlavor,
      demangleAssembly: state.configuration.demangleAssembly,
      processAssembly: state.configuration.processAssembly,
    },
    code: state.code,
    notifications: {
      seenRustSurvey2018: state.notifications.seenRustSurvey2018,
    },
  });
}

export function deserialize(savedState) {
  if (!savedState) { return undefined; }
  const parsedState = JSON.parse(savedState);
  if (parsedState.version !== CURRENT_VERSION) { return undefined; }

  const {
    configuration: parsedConfiguration = {},
    code: parsedCode,
    notifications: parsedNotifications = {},
  } = parsedState;

  // This assumes that the keys we serialize with match the keys in the
  // live state. If that's no longer true, an additional renaming step
  // needs to be added.

  return {
    configuration: { ...defaultConfiguration, ...parsedConfiguration },
    code: parsedCode || defaultCode,
    notifications: { ...defaultNotifications, ...parsedNotifications },
  };
}
