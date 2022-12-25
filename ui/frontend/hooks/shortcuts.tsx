import { useCallback, useEffect, useState } from 'react';

export const useKeyDown = (
  shortcutMap: Map<string[], Function>,
  node = document
) => {
  const [currentShortcutKeys, setCurrentShortcutKeys] = useState<string[]>([]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // If key is already depressed, return early
      if (currentShortcutKeys.includes(event.key)) {
        return;
      }
      const newShortcutKeys = currentShortcutKeys.concat([event.key]);
      for (const [keys, cb] of shortcutMap.entries()) {
        // Note: this implementation cares about order of keys pressed
        if (
          keys.length === newShortcutKeys.length &&
          keys.every((val, i) => newShortcutKeys[i] === val)
        ) {
          cb(event);
        }
      }
      setCurrentShortcutKeys(newShortcutKeys);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shortcutMap]
  );

  const handleKeyUp = (event: KeyboardEvent) => {
    setCurrentShortcutKeys((prev) => {
      const keyIndex = prev.indexOf(event.key);
      if (keyIndex !== -1) {
        return prev.slice(0, keyIndex).concat(prev.slice(keyIndex + 1));
      }
      return prev;
    });
  };

  useEffect(() => {
    node.addEventListener('keydown', handleKeyDown);
    node.addEventListener('keyup', handleKeyUp);
    return () => {
      node.removeEventListener('keydown', handleKeyDown);
      node.removeEventListener('keydown', handleKeyUp);
    };
  }, [handleKeyDown, node]);
};
