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
    .then(gist => ({
      id: id,
      url: gist.html_url,
      code: gist.files[FILENAME].content,
    }));
}

const gistBody = code => ({
  description: "Rust code shared from the playground",
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
