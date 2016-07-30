import Prism from "prismjs";

export function configureRustErrors(gotoPosition) {
  Prism.languages.rust_errors = { // eslint-disable-line camelcase
    'warning':/warning:.*\n/,
    'error': {
      pattern: /error:.*\n/,
      inside: {
        'error-explanation': /\[--explain E\d+\]/,
      },
    },
    'error-location': /-->.*\n/,
  };

  Prism.hooks.add('wrap', env => {
    if (env.type === 'error-explanation') {
      const errorMatch = /E\d+/.exec(env.content);
      const [errorCode] = errorMatch;
      env.tag = 'a';
      env.attributes.href = `https://doc.rust-lang.org/error-index.html#${errorCode}`;
    }
    if (env.type === 'error-location') {
      const errorMatch = /(\d+):(\d+)/.exec(env.content);
      const [_, line, col] = errorMatch;
      env.tag = 'a';
      env.attributes.href = '#';
      env.attributes['data-line'] = line;
      env.attributes['data-col'] = col;
    }
  });

  Prism.hooks.add('after-highlight', env => {
    env.element.querySelectorAll('.error-location').forEach(link => {
      const { line, col } = link.dataset;
      link.onclick = e => {
        e.preventDefault();
        gotoPosition(line, col);
      };
    });
  });
}
