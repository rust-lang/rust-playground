import { createSelector } from '@reduxjs/toolkit';
import { source } from 'common-tags';

import { baseUrlSelector, codeSelector } from '.';
import { State } from '../reducers';

const gistSelector = (state: State) => state.output.gist;

// Selects url.query of build configs.
const urlQuerySelector = createSelector(gistSelector, (gist) => {
  const res = new URLSearchParams();
  if (gist.channel) {
    res.set('version', gist.channel);
  }
  if (gist.mode) {
    res.set('mode', gist.mode);
  }
  if (gist.edition) {
    res.set('edition', gist.edition);
  }
  return res;
});

export const showGistLoaderSelector = createSelector(
  gistSelector,
  (gist) => gist.requestsInProgress > 0,
);

export const permalinkSelector = createSelector(
  baseUrlSelector,
  urlQuerySelector,
  gistSelector,
  (baseUrl, originalQuery, gist) => {
    const u = new URL(baseUrl);
    const query = new URLSearchParams(originalQuery);
    if (gist.id) {
      query.set('gist', gist.id);
    }
    u.search = query.toString();
    return u.href;
  },
);

export const textChangedSinceShareSelector = createSelector(
  codeSelector,
  gistSelector,
  (code, gist) => code !== gist.code,
);

const codeBlock = (code: string, language = '') => '```' + language + `\n${code}\n` + '```';

const maybeOutput = (code: string | undefined, whenPresent: (_: string) => void) => {
  if (code && code.length !== 0) {
    whenPresent(code);
  }
};

const snippetSelector = createSelector(gistSelector, permalinkSelector, (gist, permalink) => {
  let snippet = '';

  maybeOutput(gist.code, (code) => {
    snippet += source`
        ${codeBlock(code, 'rust')}

        ([Playground](${permalink}))
      `;
  });

  maybeOutput(gist.stdout, (stdout) => {
    snippet += '\n\n';
    snippet += source`
          Output:

          ${codeBlock(stdout)}
        `;
  });

  maybeOutput(gist.stderr, (stderr) => {
    snippet += '\n\n';
    snippet += source`
          Errors:

          ${codeBlock(stderr)}
        `;
  });

  return snippet;
});

export const urloUrlSelector = createSelector(snippetSelector, (snippet) => {
  const newUsersPostUrl = new URL('https://users.rust-lang.org/new-topic');
  newUsersPostUrl.searchParams.set('body', snippet);
  return newUsersPostUrl.href;
});

export const codeUrlSelector = createSelector(
  baseUrlSelector,
  urlQuerySelector,
  gistSelector,
  (baseUrl, originalQuery, gist) => {
    const u = new URL(baseUrl);
    const query = new URLSearchParams(originalQuery);
    if (gist.code) {
      query.set('code', gist.code);
    }
    u.search = new URLSearchParams(query).toString();
    return u.href;
  },
);
