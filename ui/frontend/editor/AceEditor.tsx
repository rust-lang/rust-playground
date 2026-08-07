import React, { Suspense, use, useDeferredValue } from 'react';

import { useAppSelector } from '../hooks';
import {
  aceKeybinding,
  acePairCharacters,
  aceTheme,
  offerCrateAutocompleteOnUse,
} from '../selectors';
import { CommonEditorProps } from '../types';

// These caches are unbounded, but the total number of possibilities
// is relatively small, and the amount that a human being is likely to
// actually exercise is even smaller than that. Even if every
// possibility is enumerated, I expect the memory usage to be pretty
// small.

const keybindingCache = new Map<string, Promise<void>>();
const loadKeybindingUncached = async (keybinding: string) => {
  const { importKeybinding } = await import('./AceEditorCore');
  await importKeybinding(keybinding);
};
const loadKeybinding = (keybinding: string) => {
  // Use Map.getOrInsertComputed() when it's been stable for longer
  if (!keybindingCache.has(keybinding)) {
    keybindingCache.set(keybinding, loadKeybindingUncached(keybinding));
  }
  return keybindingCache.get(keybinding)!;
};

const themeCache = new Map<string, Promise<void>>();
const loadThemeUncached = async (theme: string) => {
  const { importTheme } = await import('./AceEditorCore');
  await importTheme(theme);
};
const loadTheme = (theme: string) => {
  if (!themeCache.has(theme)) {
    themeCache.set(theme, loadThemeUncached(theme));
  }
  return themeCache.get(theme)!;
};

const pairCache = new Map<string, Promise<void>>();
const loadPairUncached = async (keybinding: string, theme: string) => {
  await Promise.all([loadKeybinding(keybinding), loadTheme(theme)]);
};
const loadPair = (keybinding: string, theme: string) => {
  const cacheKey = `${keybinding}::${theme}`;
  if (!pairCache.has(cacheKey)) {
    pairCache.set(cacheKey, loadPairUncached(keybinding, theme));
  }
  return pairCache.get(cacheKey)!;
};

const AceEditorLazy = React.lazy(() => import('./AceEditorCore'));

const AceEditorDeferred: React.FC<CommonEditorProps> = (props) => {
  const keybinding = useDeferredValue(useAppSelector(aceKeybinding));
  const theme = useDeferredValue(useAppSelector(aceTheme));

  const autocompleteOnUse = useAppSelector(offerCrateAutocompleteOnUse);
  const pairCharacters = useAppSelector(acePairCharacters);

  use(loadPair(keybinding, theme));

  return (
    <AceEditorLazy
      {...props}
      autocompleteOnUse={autocompleteOnUse}
      keybinding={keybinding}
      pairCharacters={pairCharacters}
      theme={theme}
    />
  );
};

// The ACE editor weighs in at ~250K. Adding all of the themes and the
// (surprisingly chunky) keybindings, it's not that far off from 500K!
//
// To give better initial load performance, we split the editor into a
// separate chunk. As you usually only want one of each theme and
// keybinding, they can also be split, reducing the total size
// transferred.
//
// This also has some benefit if you choose to use the simple editor,
// as ACE should never be loaded.
//
// Themes and keybindings can be changed at runtime.
const AceEditorAsync: React.FC<CommonEditorProps> = (props) => {
  return (
    <Suspense fallback={'Loading the ACE editor...'}>
      <AceEditorDeferred {...props} />
    </Suspense>
  );
};

export default AceEditorAsync;
