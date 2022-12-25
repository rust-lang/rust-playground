import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

export const useKeyDown = (keys: string[], callback: Function, node = null) => {
  const [currentShortcutKeys, setCurrentShortcutKeys] = useState<string[]>([]);

  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // If key is already depressed, return early
      if (currentShortcutKeys.includes(event.key)) {
        return;
      }
      const newShortcutKeys = currentShortcutKeys.concat([event.key]);
      // Note: this implementation cares about order of keys pressed
      if (
        keys.length === newShortcutKeys.length &&
        keys.every((val, i) => newShortcutKeys[i] === val)
      ) {
        callbackRef.current(event);
      }
      setCurrentShortcutKeys(newShortcutKeys);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys]
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
    // target is either the provided node or the whole document
    const targetNode = node ?? document;
    targetNode.addEventListener('keydown', handleKeyDown);
    targetNode.addEventListener('keyup', handleKeyUp);
    return () =>
      targetNode && targetNode.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, node]);
};
