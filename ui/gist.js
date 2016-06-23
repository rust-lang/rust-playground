import fetch from 'isomorphic-fetch';
import url from 'url';

const baseUrlObj = {
  protocol: 'https:',
  host: 'api.github.com',
  pathname: '/gists/'
};

const baseUrlStr = url.format(baseUrlObj);

export function load(id) {
  let gistUrl = url.resolve(baseUrlStr, id);
  return fetch(gistUrl)
    .then(response => response.json())
    .then(gist => gist.files['playground.rs'].content);
}
