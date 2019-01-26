import { source } from 'common-tags';
import { createSelector } from 'reselect';
import * as url from 'url';

import { State } from '../reducers';
import { Backtrace, Channel, Edition, PrimaryActionAuto, PrimaryActionCore } from '../types';

const codeSelector = (state: State) => state.code;

const HAS_TESTS_RE = /^\s*#\s*\[\s*test\s*([^"]*)]/m;
export const hasTestsSelector = createSelector(codeSelector, code => !!code.match(HAS_TESTS_RE));

const HAS_MAIN_FUNCTION_RE = /^\s*(pub\s+)?fn\s+main\s*\(\s*\)/m;
export const hasMainFunctionSelector = createSelector(codeSelector, code => !!code.match(HAS_MAIN_FUNCTION_RE));

const CRATE_TYPE_RE = /^\s*#!\s*\[\s*crate_type\s*=\s*"([^"]*)"\s*]/m;
export const crateTypeSelector = createSelector(codeSelector, code => (code.match(CRATE_TYPE_RE) || [])[1]);

const autoPrimaryActionSelector = createSelector(
  crateTypeSelector,
  hasTestsSelector,
  hasMainFunctionSelector,
  (crateType, hasTests, hasMainFunction) => {
    if (crateType) {
      if (crateType === 'bin') {
        return PrimaryActionCore.Execute;
      } else {
        return PrimaryActionCore.Compile;
      }
    } else {
      if (hasTests) {
        return PrimaryActionCore.Test;
      } else if (hasMainFunction) {
        return PrimaryActionCore.Execute;
      } else {
        return PrimaryActionCore.Compile;
      }
    }
  },
);

export const runAsTest = createSelector(
  autoPrimaryActionSelector,
  primaryAction => primaryAction === PrimaryActionCore.Test,
);
export const getCrateType = createSelector(
  autoPrimaryActionSelector,
  primaryAction => primaryAction === PrimaryActionCore.Execute ? 'bin' : 'lib',
);

const rawPrimaryActionSelector = (state: State) => state.configuration.primaryAction;

export const isAutoBuildSelector = createSelector(
  rawPrimaryActionSelector,
  autoPrimaryActionSelector,
  (primaryAction, autoPrimaryAction) => (
    primaryAction === PrimaryActionAuto.Auto && autoPrimaryAction === PrimaryActionCore.Compile
  ),
);

const primaryActionSelector = createSelector(
  rawPrimaryActionSelector,
  autoPrimaryActionSelector,
  (primaryAction, autoPrimaryAction): PrimaryActionCore => (
    primaryAction === PrimaryActionAuto.Auto ? autoPrimaryAction : primaryAction
  ),
);

const LABELS: { [index in PrimaryActionCore]: string } = {
  [PrimaryActionCore.Asm]: 'Show Assembly',
  [PrimaryActionCore.Compile]: 'Build',
  [PrimaryActionCore.Execute]: 'Run',
  [PrimaryActionCore.LlvmIr]: 'Show LLVM IR',
  [PrimaryActionCore.Mir]: 'Show MIR',
  [PrimaryActionCore.Test]: 'Test',
  [PrimaryActionCore.Wasm]: 'Show WASM',
};

export const getExecutionLabel = createSelector(primaryActionSelector, primaryAction => LABELS[primaryAction]);

const getStable = (state: State) => state.versions && state.versions.stable;
const getBeta = (state: State) => state.versions && state.versions.beta;
const getNightly = (state: State) => state.versions && state.versions.nightly;
const getRustfmt = (state: State) => state.versions && state.versions.rustfmt;
const getClippy = (state: State) => state.versions && state.versions.clippy;
const getMiri = (state: State) => state.versions && state.versions.miri;

const versionNumber = v => v ? v.version : '';
export const stableVersionText = createSelector([getStable], versionNumber);
export const betaVersionText = createSelector([getBeta], versionNumber);
export const nightlyVersionText = createSelector([getNightly], versionNumber);
export const clippyVersionText = createSelector([getClippy], versionNumber);
export const rustfmtVersionText = createSelector([getRustfmt], versionNumber);
export const miriVersionText = createSelector([getMiri], versionNumber);

const versionDetails = v => v ? `${v.date} ${v.hash.slice(0, 20)}` : '';
export const betaVersionDetailsText = createSelector([getBeta], versionDetails);
export const nightlyVersionDetailsText = createSelector([getNightly], versionDetails);
export const clippyVersionDetailsText = createSelector([getClippy], versionDetails);
export const rustfmtVersionDetailsText = createSelector([getRustfmt], versionDetails);
export const miriVersionDetailsText = createSelector([getMiri], versionDetails);

const editionSelector = (state: State) => state.configuration.edition;

export const isWasmAvailable = (state: State) => (
  state.configuration.channel === Channel.Nightly
);

export const getModeLabel = (state: State) => {
  const { configuration: { mode } } = state;
  return `${mode}`;
};

export const getChannelLabel = (state: State) => {
  const { configuration: { channel } } = state;
  return `${channel}`;
};

export const getEditionSet = createSelector(
  editionSelector,
  edition => edition !== Edition.Rust2018,
);

export const getBacktraceSet = (state: State) => (
  state.configuration.backtrace !== Backtrace.Disabled
);

export const getAdvancedOptionsSet = createSelector(
  getEditionSet, getBacktraceSet,
  (editionSet, backtraceSet) => (
    editionSet || backtraceSet
  ),
);

export const hasProperties = obj => Object.values(obj).some(val => !!val);

const getOutputs = (state: State) => [
  state.output.assembly,
  state.output.clippy,
  state.output.execute,
  state.output.format,
  state.output.gist,
  state.output.llvmIr,
  state.output.mir,
  state.output.miri,
  state.output.wasm,
];

export const getSomethingToShow = createSelector(
  getOutputs,
  a => a.some(hasProperties),
);

const baseUrlSelector = (state: State) =>
  state.globalConfiguration.baseUrl;

const gistSelector = (state: State) =>
  state.output.gist;

// Selects url.query of build configs.
const urlQuerySelector = createSelector(
  gistSelector,
  gist => ({
    version: gist.channel,
    mode: gist.mode,
    edition: gist.edition,
  }),
);

export const showGistLoaderSelector = createSelector(
  gistSelector,
  gist => gist.requestsInProgress > 0,
);

export const permalinkSelector = createSelector(
  baseUrlSelector, urlQuerySelector, gistSelector,
  (baseUrl, query, gist) => {
    const u = url.parse(baseUrl, true);
    u.query = { ...query, gist: gist.id };
    return url.format(u);
  },
);

const codeBlock = (code: string, language = '') =>
  '```' + language + `\n${code}\n` + '```';

const maybeOutput = (code: string, whenPresent: (_: string) => void) => {
  const val = (code || '').trim();
  if (val.length !== 0) { whenPresent(code); }
};

const snippetSelector = createSelector(
  gistSelector, permalinkSelector,
  (gist, permalink) => {
    let snippet =
      source`
        ${codeBlock(gist.code, 'rust')}

        ([Playground](${permalink}))
      `;

    maybeOutput(gist.stdout, stdout => {
      snippet += '\n\n';
      snippet +=
        source`
          Output:

          ${codeBlock(stdout)}
        `;
    });

    maybeOutput(gist.stderr, stderr => {
      snippet += '\n\n';
      snippet +=
        source`
          Errors:

          ${codeBlock(stderr)}
        `;
    });

    return snippet;
  },
);

export const urloUrlSelector = createSelector(
  snippetSelector,
  snippet => {
    const newUsersPostUrl = url.parse('https://users.rust-lang.org/new-topic', true);
    newUsersPostUrl.query = { body: snippet };
    return url.format(newUsersPostUrl);
  },
);

export const issueUrlSelector = createSelector(
  snippetSelector,
  snippet => {
    const newIssueUrl = url.parse('https://github.com/rust-lang/rust/issues/new', true);
    newIssueUrl.query = { body: snippet };
    return url.format(newIssueUrl);
  },
);

export const codeUrlSelector = createSelector(
  baseUrlSelector, urlQuerySelector, gistSelector,
  (baseUrl, query, gist) => {
    const u = url.parse(baseUrl, true);
    u.query = { ...query, code: gist.code };
    return url.format(u);
  },
);

const notificationsSelector = (state: State) => state.notifications;

const NOW = new Date();
const RUST_2018_DEFAULT_END = new Date('2019-01-01T00:00:00Z');
const RUST_2018_DEFAULT_OPEN = NOW <= RUST_2018_DEFAULT_END;
export const showRust2018IsDefaultSelector = createSelector(
  notificationsSelector,
  notifications => RUST_2018_DEFAULT_OPEN && !notifications.seenRust2018IsDefault,
);

export const anyNotificationsToShowSelector = createSelector(
  showRust2018IsDefaultSelector,
  allNotifications => allNotifications,
);

export const clippyRequestSelector = createSelector(
  codeSelector,
  editionSelector,
  getCrateType,
  (code, edition, crateType) => ({ code, edition, crateType }),
);
