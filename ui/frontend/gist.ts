import fetch from 'isomorphic-fetch';
import url from 'url';

const baseUrlObj = {
  protocol: 'https:',
  host: 'api.github.com',
  pathname: '/gists',
};

const baseUrlStr = url.format(baseUrlObj);

const FILENAME = 'playground.rs';

export function load(id) {
  return fetch(`${baseUrlStr}/${id}`)
    .then(response => response.json())
    .then(convertGistResponse);
}

const convertGistResponse = gist => ({
  id: gist.id,
  url: gist.html_url,
  code: codeFromGist(Object.values(gist.files)),
});

const codeFromGist = gistFiles => {
  gistFiles.sort(f => f.filename);

  switch (gistFiles.length) {
  case 0:
  case 1:
    return gistFiles
      .map(({ content }) => content)
      .join('');
  default:
    return gistFiles
      .map(({ filename, content }) => `// ${filename}\n\n${content}`)
      .join('\n\n');
  }
};

const gistBody = code => ({
  description: 'Rust code shared from the playground',
  public: true,
  files: {
    [FILENAME]: {
      content: code,
    },
  },
});

export function save(code) {
  return fetch(baseUrlStr, {
    method: 'post',
    body: JSON.stringify(gistBody(code)),
  })
    .then(response => response.json())
    .then(({ id, html_url: url }) => ({ id, url }));
}
