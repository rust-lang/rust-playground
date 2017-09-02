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
    .then(gist => {
      const filenames = Object.keys(gist.files);
      if (filenames.length > 0) {
        let code = gist.files[filenames[0]].content;
        if (filenames.length > 1) {
          code = filenames.reduce(
                            (code, filename) => `${code}\n\n// ${filename}\n\n${gist.files[filename].content}`
                            , '')
                            .trimLeft();
        }
        return {
          id: id,
          url: gist.html_url,
          code: code,
        };
      } else {
        alert(`No file inside gist ${baseUrlStr}/${id}`);
        // FIXME better errorhandling
        return {};
      }
    });
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
