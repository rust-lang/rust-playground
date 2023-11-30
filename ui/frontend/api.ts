import fetch from 'isomorphic-fetch';

export const routes = {
  compile: '/compile',
  execute: '/execute',
  format: '/format',
  clippy: '/clippy',
  miri: '/miri',
  macroExpansion: '/macro-expansion',
  meta: {
    crates: '/meta/crates',
    versions: '/meta/versions',
    gistSave: '/meta/gist',
    gistLoad: '/meta/gist/id',
  },
};

type FetchArg = Parameters<typeof fetch>[0];

export function jsonGet(url: FetchArg): Promise<unknown> {
  return fetchJson(url, {
    method: 'get',
  });
}

export function jsonPost(url: FetchArg, body: Record<string, any>): Promise<unknown> {
  return fetchJson(url, {
    method: 'post',
    body: JSON.stringify(body),
  });
}

async function fetchJson(url: FetchArg, args: RequestInit) {
  const headers = new Headers(args.headers);
  headers.set('Content-Type', 'application/json');

  let response;
  try {
    response = await fetch(url, { ...args, headers });
  } catch (networkError) {
    // e.g. server unreachable
    if (networkError instanceof Error) {
      throw {
        error: `Network error: ${networkError.toString()}`,
      };
    } else {
      throw {
        error: 'Unknown error while fetching JSON',
      };
    }
  }

  let body;
  try {
    body = await response.json();
  } catch (convertError) {
    if (convertError instanceof Error) {
      throw {
        error: `Response was not JSON: ${convertError.toString()}`,
      };
    } else {
      throw {
        error: 'Unknown error while converting JSON',
      };
    }
  }

  if (response.ok) {
    // HTTP 2xx
    return body;
  } else {
    // HTTP 4xx, 5xx (e.g. malformed JSON request)
    throw body;
  }
}

// We made some strange decisions with how the `fetchJson` function
// communicates errors, so we untwist those here to fit better with
// redux-toolkit's ideas.
export const adaptFetchError = async <R>(cb: () => Promise<R>): Promise<R> => {
  let result;

  try {
    result = await cb();
  } catch (e) {
    if (e && typeof e === 'object' && 'error' in e && typeof e.error === 'string') {
      throw new Error(e.error);
    } else {
      throw new Error('An unknown error occurred');
    }
  }

  if (
    result &&
    typeof result === 'object' &&
    'error' in result &&
    typeof result.error === 'string'
  ) {
    throw new Error(result.error);
  }

  return result;
};
