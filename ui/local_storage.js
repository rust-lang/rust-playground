const CURRENT_VERSION = 1;

export function serialize(state) {
  return JSON.stringify({
    version: CURRENT_VERSION,
    code: state.code
  });
}

export function deserialize(savedState) {
  if (!savedState) { return undefined; }
  const parsedState = JSON.parse(savedState);
  if (parsedState.version != CURRENT_VERSION) { return undefined; }

  return {
    code: parsedState.code
  };
}
