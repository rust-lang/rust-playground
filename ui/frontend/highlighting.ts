import Prism from 'prismjs';

export function configureRustErrors({
  enableFeatureGate,
  getChannel,
  gotoPosition,
  reExecuteWithBacktrace,
}) {
  Prism.languages.rust_errors = { // eslint-disable-line @typescript-eslint/camelcase
    'warning': {
      pattern: /^warning(\[E\d+\])?:.*$/m,
      inside: {
        'error-explanation': /\[E\d+\]/,
      },
    },
    'error': {
      pattern: /^error(\[E\d+\])?:.*$/m,
      inside: {
        'error-explanation': /\[E\d+\]/,
      },
    },
    'note': {
      pattern: /^\s*=\s*note:.*$/m,
      inside: {
        'see-issue': /see .*rust-lang\/rust\/issues\/\d+/,
      },
    },
    'error-location': /-->\s+(\/playground\/)?src\/.*\n/,
    'rust-errors-help': {
      pattern: /help:.*\n/,
      inside: {
        'feature-gate': /add #\!\[feature\(.+?\)\]/,
      },
    },
    'backtrace': {
      pattern: /at src\/.*\n/,
      inside: {
        'backtrace-location': /src\/main.rs:(\d+)/,
      },
    },
    'backtrace-enable': /Run with `RUST_BACKTRACE=1` environment variable to display a backtrace/i,
  };

  Prism.hooks.add('wrap', env => {
    if (env.type === 'error-explanation') {
      const errorMatch = /E\d+/.exec(env.content);
      const [errorCode] = errorMatch;
      env.tag = 'a';
      env.attributes.href = `https://doc.rust-lang.org/${getChannel()}/error-index.html#${errorCode}`;
      env.attributes.target = '_blank';
    }
    if (env.type === 'see-issue') {
      const errorMatch = /\d+/.exec(env.content);
      const [errorCode] = errorMatch;
      env.tag = 'a';
      env.attributes.href = `https://github.com/rust-lang/rust/issues/${errorCode}`;
      env.attributes.target = '_blank';
    }
    if (env.type === 'error-location') {
      let line;
      let col;
      const errorMatchFull = /(\d+):(\d+)/.exec(env.content);
      if (errorMatchFull) {
        line = errorMatchFull[1];
        col = errorMatchFull[2];
      } else {
        const errorMatchShort = /:(\d+)/.exec(env.content);
        line = errorMatchShort[1];
        col = '1';
      }
      env.tag = 'a';
      env.attributes.href = '#';
      env.attributes['data-line'] = line;
      env.attributes['data-col'] = col;
    }
    if (env.type === 'feature-gate') {
      const [_, featureGate] = /feature\((.*?)\)/.exec(env.content);
      env.tag = 'a';
      env.attributes.href = '#';
      env.attributes['data-feature-gate'] = featureGate;
    }
    if (env.type === 'backtrace-enable') {
      env.tag = 'a';
      env.attributes.href = '#';
      env.attributes['data-backtrace-enable'] = 'true';
    }
    if (env.type === 'backtrace-location') {
      const errorMatch = /:(\d+)/.exec(env.content);
      const [_, line] = errorMatch;
      env.tag = 'a';
      env.attributes.href = '#';
      env.attributes['data-line'] = line;
      env.attributes['data-col'] = '1';
    }
  });

  Prism.hooks.add('after-highlight', env => {
    const links = env.element.querySelectorAll('.error-location, .backtrace-location');
    Array.from(links).forEach((link: HTMLAnchorElement) => {
      const { line, col } = link.dataset;
      link.onclick = e => {
        e.preventDefault();
        gotoPosition(line, col);
      };
    });

    const featureGateEnablers = env.element.querySelectorAll('.feature-gate');
    Array.from(featureGateEnablers).forEach((link: HTMLAnchorElement) => {
      link.onclick = e => {
        e.preventDefault();
        enableFeatureGate(link.dataset.featureGate);
        gotoPosition(1, 1);
      };
    });

    const backtraceEnablers = env.element.querySelectorAll('.backtrace-enable');
    Array.from(backtraceEnablers).forEach((link: HTMLAnchorElement) => {
      link.onclick = e => {
        e.preventDefault();
        reExecuteWithBacktrace();
      };
    });
  });
}
