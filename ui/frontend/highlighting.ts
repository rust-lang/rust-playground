import Prism from "prismjs";

export function configureRustErrors(gotoPosition) {
  Prism.languages.rust_errors = { // eslint-disable-line camelcase
    'warning':/warning:.*\n/,
    'error': {
      pattern: /error(\[E\d+\])?:.*\n/,
      inside: {
        'error-explanation': /\[E\d+\]/,
      },
    },
    'error-location': /-->.*\n/,
    'stack-trace-location': /at \/playground.*\n/,
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
    if (env.type === 'stack-trace-location') {
      const errorMatch = /main.rs:(\d+)/.exec(env.content);
      const [_, line] = errorMatch;
      env.tag = 'a';
      env.attributes.href = '#';
      env.attributes['data-line'] = line;
      env.attributes['data-col'] = "1";
    }
  });

  Prism.hooks.add('after-highlight', env => {
    const links = env.element.querySelectorAll('.error-location, .stack-trace-location');
    Array.from(links).forEach((link: HTMLAnchorElement) => {
      const { line, col } = link.dataset;
      link.onclick = e => {
        e.preventDefault();
        gotoPosition(line, col);
      };
    });
  });
}
