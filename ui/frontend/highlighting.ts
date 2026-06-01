import Prism from 'prismjs';
import { Channel, makePosition, Position } from './types';

interface ConfigureRustErrorsArgs {
  enableFeatureGate: (feature: string) => void;
  getChannel: () => Channel;
  getMultifile: () => boolean;
  activateFile: (f: string) => void;
  gotoPosition: (p: Position) => void;
  selectText: (start: Position, end: Position) => void;
  addImport: (code: string) => void;
  reExecuteWithBacktrace: () => void;
}

export function configureRustErrors({
  enableFeatureGate,
  getChannel,
  getMultifile,
  activateFile,
  gotoPosition,
  selectText,
  addImport,
  reExecuteWithBacktrace,
}: ConfigureRustErrorsArgs) {
  Prism.languages.rust_errors = {
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
        'see-issue': /see .*rust-lang\/rust\/issues\/\d+>/,
      },
    },
    'error-location': /-->\s+.*\.rs:.*\n/,
    'import-suggestion-outer': {
      pattern: /\+\s+use\s+([^;]+);/,
      inside: {
        'import-suggestion': /use\s+.*/,
      },
    },
    'rust-errors-help': {
      pattern: /help:.*\n/,
      inside: {
        'feature-gate': /add `#!\[feature\(.+?\)\]`/,
      },
    },
    'backtrace': {
      pattern: /(panicked |\s+)at [^:]+\.rs.*\n/,
      inside: {
        'backtrace-location': {
          pattern: /(at )[^:]+:\d+:\d+/,
          lookbehind: true,
        },
      },
    },
    'backtrace-enable': /Run with `RUST_BACKTRACE=1` environment variable to display a backtrace/i,
  };

  Prism.languages.rust_mir = {
    'mir-source': /src\/[A-Za-z0-9_.-]+\.rs:\d+:\d+: \d+:\d+/,
  }

  Prism.hooks.add('wrap', env => {
    if (env.type === 'error-explanation') {
      const errorMatch = /E\d+/.exec(env.content);
      if (errorMatch) {
        const [errorCode] = errorMatch;
        env.tag = 'a';
        env.attributes.href = `https://doc.rust-lang.org/${getChannel()}/error_codes/${errorCode}.html`;
        env.attributes.target = '_blank';
      }
    }
    if (env.type === 'see-issue') {
      const errorMatch = /\d+/.exec(env.content);
      if (errorMatch) {
        const [errorCode] = errorMatch;
        env.tag = 'a';
        env.attributes.href = `https://github.com/rust-lang/rust/issues/${errorCode}`;
        env.attributes.target = '_blank';
      }
    }
    if (env.type === 'error-location') {
      const errorMatch = /\s([^:]*):(\d+)(?::(\d+))?/.exec(env.content);
      if (errorMatch) {
        const [_, file, line, col = '1'] = errorMatch;

        env.tag = 'a';
        env.attributes.href = '#';
        env.attributes['data-file'] = file;
        env.attributes['data-line'] = line;
        env.attributes['data-col'] = col;
      }
    }
    // I don't know how to tell which file(s) to place the import into.
    if (!getMultifile() && env.type === 'import-suggestion') {
      env.tag = 'a';
      env.attributes.href = '#';
      env.attributes['data-suggestion'] = env.content;
    }
    // I don't know how to tell which file(s) to place the feature flag into.
    if (!getMultifile() && env.type === 'feature-gate') {
      const featureMatch = /feature\((.*?)\)/.exec(env.content);
      if (featureMatch) {
        const [_, featureGate] = featureMatch;
        env.tag = 'a';
        env.attributes.href = '#';
        env.attributes['data-feature-gate'] = featureGate;
      }
    }
    if (env.type === 'backtrace-enable') {
      env.tag = 'a';
      env.attributes.href = '#';
      env.attributes['data-backtrace-enable'] = 'true';
    }
    if (env.type === 'backtrace-location') {
      const errorMatch = /([^:]+):(\d+):(\d+)/.exec(env.content);
      if (errorMatch) {
        const [_, file, line, col] = errorMatch;

        if (!file.includes('.rustup') && !file.includes('/rustc/')) {
          const normalizedFile = file.replace(/^\.\//, '')

          env.tag = 'a';
          env.attributes.href = '#';
          env.attributes['data-file'] = normalizedFile;
          env.attributes['data-line'] = line;
          env.attributes['data-col'] = col;
        }
      }
    }
    if (env.type === 'mir-source') {
      const lineMatch = /(\d+):(\d+): (\d+):(\d+)/.exec(env.content);
      if (lineMatch) {
        const [_, startLine, startCol, endLine, endCol] = lineMatch;
        env.tag = 'a';
        env.attributes.href = '#';
        env.attributes['data-start-line'] = startLine;
        env.attributes['data-start-col'] = startCol;
        env.attributes['data-end-line'] = endLine;
        env.attributes['data-end-col'] = endCol;
      }
    }
  });

  Prism.hooks.add('after-highlight', env => {
    const links = env.element.querySelectorAll('.error-location, .backtrace-location');
    Array.from(links).forEach(link => {
      if (link instanceof HTMLAnchorElement) {
        const { file, line, col } = link.dataset;
        link.onclick = e => {
          e.preventDefault();
          if (file) {
            activateFile(file);
          }
          if (line && col) {
            gotoPosition(makePosition(line, col));
          }
        };
      }
    });

    const importSuggestions = env.element.querySelectorAll('.import-suggestion');
    Array.from(importSuggestions).forEach(link => {
      if (link instanceof HTMLAnchorElement) {
        const { suggestion } = link.dataset;
        link.onclick = (e) => {
          e.preventDefault();
          addImport(suggestion + '\n');
        };
      }
    });

    const featureGateEnablers = env.element.querySelectorAll('.feature-gate');
    Array.from(featureGateEnablers).forEach(link => {
      if (link instanceof HTMLAnchorElement) {
        link.onclick = e => {
          e.preventDefault();
          if (link.dataset.featureGate) {
            enableFeatureGate(link.dataset.featureGate);
            gotoPosition(makePosition(1, 1));
          }
        };
      }
    });

    const backtraceEnablers = env.element.querySelectorAll('.backtrace-enable');
    Array.from(backtraceEnablers).forEach(link => {
      if (link instanceof HTMLAnchorElement) {
        link.onclick = e => {
          e.preventDefault();
          reExecuteWithBacktrace();
        };
      }
    });

    const mirSourceLinks = env.element.querySelectorAll('.mir-source');
    Array.from(mirSourceLinks).forEach(link => {
      if (link instanceof HTMLAnchorElement) {
        const { startLine, startCol, endLine, endCol } = link.dataset;
        if (startLine && startCol && endLine && endCol) {
          const start = makePosition(startLine, startCol);
          const end = makePosition(endLine, endCol);

          link.onclick = e => {
            e.preventDefault();
            selectText(start, end);
          };
        }
      }
    });
  });
}
