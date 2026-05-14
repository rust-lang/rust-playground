import { createSelector } from '@reduxjs/toolkit';
import { source } from 'common-tags';

import { baseUrlSelector, codeOrFilesSelector } from '.';
import { State } from '../reducers';

const gistCodeSelector = (state: State) => state.output.gist.code;

const linearCodeSelector = createSelector(gistCodeSelector, (code) => {
  if (!code) {
    return code;
  }
  if (typeof code === 'string') {
    return code;
  } else {
    const f = [...code];
    f.sort((a, b) => a.name.localeCompare(b.name));
    return f.reduce((acc, f) => acc + `// ${f.name}` + '\n\n' + f.content + '\n', '');
  }
});

// Selects url.query of build configs.
const urlQuerySelector = createSelector(
  (state: State) => state.output.gist.channel,
  (state: State) => state.output.gist.mode,
  (state: State) => state.output.gist.edition,
  (channel, mode, edition) => {
    const res = new URLSearchParams();
    if (channel) {
      res.set('version', channel);
    }
    if (mode) {
      res.set('mode', mode);
    }
    if (edition) {
      res.set('edition', edition);
    }
    return res;
  },
);

export const showGistLoaderSelector = createSelector(
  (state: State) => state.output.gist.requestsInProgress,
  (requestsInProgress) => requestsInProgress > 0,
);

export const permalinkSelector = createSelector(
  baseUrlSelector,
  urlQuerySelector,
  (state: State) => state.output.gist.id,
  (baseUrl, originalQuery, id) => {
    const u = new URL(baseUrl);
    const query = new URLSearchParams(originalQuery);
    if (id) {
      query.set('gist', id);
    }
    u.search = query.toString();
    return u.href;
  },
);

export const textChangedSinceShareSelector = createSelector(
  codeOrFilesSelector,
  gistCodeSelector,
  (code, gistCode) => {
    if (typeof code === 'string' && typeof gistCode === 'string') {
      return code !== gistCode;
    } else if (Array.isArray(code) && Array.isArray(gistCode)) {
      // Does the count of files match?
      if (code.length !== gistCode.length) {
        return true;
      }

      const codeMap = new Map(code.map((c) => [c.name, c.content]));
      const gistCodeMap = new Map(gistCode.map((gc) => [gc.name, gc.content]));

      const codeFiles = new Set(codeMap.keys());
      const gistCodeFiles = new Set(gistCodeMap.keys());

      // Do all the filenames match?
      if (codeFiles.symmetricDifference(gistCodeFiles).size !== 0) {
        return true;
      }

      // Do all of the contents match?
      return codeMap.entries().some(([name, content]) => {
        const gistContent = gistCodeMap.get(name);
        return gistContent !== content;
      });
    } else {
      return true;
    }
  },
);

const codeBlock = (code: string, language = '') => '```' + language + `\n${code}\n` + '```';

const maybeOutput = (code: string | undefined, whenPresent: (_: string) => void) => {
  if (code && code.length !== 0) {
    whenPresent(code);
  }
};

const snippetSelector = createSelector(
  codeOrFilesSelector,
  (state: State) => state.output.gist.stdout,
  (state: State) => state.output.gist.stderr,
  permalinkSelector,
  (code, stdout, stderr, permalink) => {
    let snippet = '';

    if (typeof code === 'string') {
      maybeOutput(code, (code) => {
        snippet += source`
        ${codeBlock(code, 'rust')}

        ([Playground](${permalink}))
      `;
      });
    } else {
      for (const { name, content } of code) {
        snippet += source`
        **${name}**
        ${codeBlock(content, 'rust')}
      `;
      }
      snippet += source`
        ([Playground](${permalink}))
      `;
    }

    maybeOutput(stdout, (stdout) => {
      snippet += '\n\n';
      snippet += source`
          Output:

          ${codeBlock(stdout)}
        `;
    });

    maybeOutput(stderr, (stderr) => {
      snippet += '\n\n';
      snippet += source`
          Errors:

          ${codeBlock(stderr)}
        `;
    });

    return snippet;
  },
);

export const urloUrlSelector = createSelector(snippetSelector, (snippet) => {
  const newUsersPostUrl = new URL('https://users.rust-lang.org/new-topic');
  newUsersPostUrl.searchParams.set('body', snippet);
  return newUsersPostUrl.href;
});

export const codeUrlSelector = createSelector(
  baseUrlSelector,
  urlQuerySelector,
  linearCodeSelector,
  (baseUrl, originalQuery, code) => {
    const u = new URL(baseUrl);
    const query = new URLSearchParams(originalQuery);
    if (code) {
      query.set('code', code);
    }
    u.search = new URLSearchParams(query).toString();
    return u.href;
  },
);
