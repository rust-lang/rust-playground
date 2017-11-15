import { DEFAULT as defaultConfiguration } from './reducers/configuration';
const CURRENT_VERSION = 1;

export function serialize(state) {
  return JSON.stringify({
    version: CURRENT_VERSION,
    configuration: {
      editor: state.configuration.editor,
      keybinding: state.configuration.keybinding,
      theme: state.configuration.theme,
      orientation: state.configuration.orientation,
      assemblyFlavor: state.configuration.assemblyFlavor,
      demangleAssembly: state.configuration.demangleAssembly,
      hideAssemblerDirectives: state.configuration.hideAssemblerDirectives,
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
      assemblyFlavor: parsedState.configuration.assemblyFlavor || defaultConfiguration.assemblyFlavor,
      demangleAssembly: parsedState.configuration.demangleAssembly || defaultConfiguration.demangleAssembly,
      hideAssemblerDirectives:
        parsedState.configuration.hideAssemblerDirectives || defaultConfiguration.hideAssemblerDirectives,
    },
    code: parsedState.code,
  };
}
