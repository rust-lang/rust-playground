import { defaultConfiguration } from './reducers';
const CURRENT_VERSION = 1;

export function serialize(state) {
  return JSON.stringify({
    version: CURRENT_VERSION,
    configuration: {
      editor: state.configuration.editor,
      keybinding: state.configuration.keybinding,
      theme: state.configuration.theme,
      orientation: state.configuration.orientation,
    },
    code: state.code,
  });
}

export function deserialize(savedState) {
  if (!savedState) { return undefined; }
  const parsedState = JSON.parse(savedState);
  if (parsedState.version !== CURRENT_VERSION) { return undefined; }

  return {
    configuration: {
      ...defaultConfiguration,
      editor: parsedState.configuration.editor || defaultConfiguration.editor,
      keybinding: parsedState.configuration.keybinding || defaultConfiguration.keybinding,
      theme: parsedState.configuration.theme || defaultConfiguration.theme,
      orientation: parsedState.configuration.orientation || defaultConfiguration.orientation,
    },
    code: parsedState.code,
  };
}
