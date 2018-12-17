import { deserialize } from './local_storage';

describe('restoring saved state', () => {
  const easyDeserialize = (state: any) => {
    if (typeof state === 'string' || state === undefined) {
      return deserialize(state);
    } else {
      state.version = 1;
      return deserialize(JSON.stringify(state));
    }
  };

  test('undefined state stays that way', () => {
    expect(easyDeserialize(undefined)).toBeUndefined();
  });

  test('unknown serialized version resets to defaults', () => {
    expect(easyDeserialize('{"version":42}')).toBeUndefined();
  });

  test('serialized data is kept', () => {
    const parsed = easyDeserialize({
      configuration: { theme: 'xcode' },
      code: 'not default code',
      notifications: { seenRustSurvey2018: true },
    });

    expect(parsed.configuration.theme).toEqual('xcode');
    expect(parsed.code).toEqual('not default code');
    expect(parsed.notifications.seenRustSurvey2018).toBe(true);
  });
});
