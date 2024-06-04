import { source } from 'common-tags';
import { createSelector } from '@reduxjs/toolkit';

import { State } from '../reducers';
import {
  Backtrace,
  CargoScript,
  Channel,
  Edition,
  Focus,
  Orientation,
  PrimaryActionAuto,
  PrimaryActionCore,
  Version,
} from '../types';

export const codeSelector = (state: State) => state.code;
export const positionSelector = (state: State) => state.position;
export const selectionSelector = (state: State) => state.selection;
export const cargoScriptSelector = (state: State) => state.configuration.cargoScript === CargoScript.Enabled

const HAS_TESTS_RE = /^\s*#\s*\[\s*test\s*([^"]*)]/m;
export const hasTestsSelector = createSelector(codeSelector, code => !!code.match(HAS_TESTS_RE));

// https://stackoverflow.com/a/34755045/155423
const HAS_MAIN_FUNCTION_RE = new RegExp(
  [
    /^([^\n\r\/]*;)?/,
    /\s*(pub\s+)?\s*(const\s+)?\s*(async\s+)?\s*/,
    /fn\s+main\s*\(\s*(\/\*.*\*\/)?\s*\)/,
  ].map((r) => r.source).join(''),
  'm'
);
export const hasMainFunctionSelector = createSelector(codeSelector, code => !!code.match(HAS_MAIN_FUNCTION_RE));

const CRATE_TYPE_RE = /^\s*#!\s*\[\s*crate_type\s*=\s*"([^"]*)"\s*]/m;
export const crateTypeSelector = createSelector(codeSelector, code => (code.match(CRATE_TYPE_RE) || [])[1]);

const autoPrimaryActionSelector = createSelector(
  crateTypeSelector,
  hasTestsSelector,
  hasMainFunctionSelector,
  (crateType, hasTests, hasMainFunction) => {
    if (crateType && crateType !== 'proc-macro') {
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
  crateTypeSelector,
  autoPrimaryActionSelector,
  (crateType, primaryAction) => {
    if (crateType) {
      return crateType;
    } else if (primaryAction === PrimaryActionCore.Execute) {
      return 'bin';
    } else {
      return 'lib';
    }
  },
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
  [PrimaryActionCore.Hir]: 'Show HIR',
  [PrimaryActionCore.Mir]: 'Show MIR',
  [PrimaryActionCore.Test]: 'Test',
  [PrimaryActionCore.Wasm]: 'Show Wasm',
};

export const getExecutionLabel = createSelector(primaryActionSelector, primaryAction => LABELS[primaryAction]);

const channelSelector = (state: State) => state.configuration.channel;

const selectedChannelVersionsSelector = createSelector(
  channelSelector,
  (state: State) => state.versions,
  (channel, versions) => {
    switch (channel) {
      case Channel.Stable:
        return versions.stable;
      case Channel.Beta:
        return versions.beta;
      case Channel.Nightly:
        return versions.nightly;
    }
  },
)

const getStable = (state: State) => state.versions.stable?.rustc;
const getBeta = (state: State) => state.versions.beta?.rustc;
const getNightly = (state: State) => state.versions.nightly?.rustc;
const getRustfmt = createSelector(selectedChannelVersionsSelector, (versions) => versions?.rustfmt);
const getClippy = createSelector(selectedChannelVersionsSelector, (versions) => versions?.clippy);
const getMiri = (state: State) => state.versions?.nightly?.miri;

const versionNumber = (v: Version | undefined) => v ? v.version : '';
export const stableVersionText = createSelector(getStable, versionNumber);
export const betaVersionText = createSelector(getBeta, versionNumber);
export const nightlyVersionText = createSelector(getNightly, versionNumber);
export const clippyVersionText = createSelector(getClippy, versionNumber);
export const rustfmtVersionText = createSelector(getRustfmt, versionNumber);
export const miriVersionText = createSelector(getMiri, versionNumber);

const versionDetails = (v: Version | undefined) => v ? `${v.date} ${v.hash.slice(0, 20)}` : '';
export const betaVersionDetailsText = createSelector(getBeta, versionDetails);
export const nightlyVersionDetailsText = createSelector(getNightly, versionDetails);
export const clippyVersionDetailsText = createSelector(getClippy, versionDetails);
export const rustfmtVersionDetailsText = createSelector(getRustfmt, versionDetails);
export const miriVersionDetailsText = createSelector(getMiri, versionDetails);

const editionSelector = (state: State) => state.configuration.edition;

export const isNightlyChannel = createSelector(
  channelSelector,
  (channel) => channel === Channel.Nightly,
);
export const isHirAvailable = isNightlyChannel;

export const wasmLikelyToWork = createSelector(
  crateTypeSelector,
  getCrateType, (userCrateType, crateType) => {
    // If the user set it already, assume they know what they are doing
    if (userCrateType) { return true }

    return crateType === 'cdylib';
  });

export const getModeLabel = (state: State) => {
  const { configuration: { mode } } = state;
  return `${mode}`;
};

export const getChannelLabel = createSelector(channelSelector, (channel) => `${channel}`);

export const isEditionDefault = createSelector(
  editionSelector,
  edition => edition == Edition.Rust2021,
);

export const getBacktraceSet = (state: State) => (
  state.configuration.backtrace !== Backtrace.Disabled
);

export const getAdvancedOptionsSet = createSelector(
  isEditionDefault, getBacktraceSet,
  (editionDefault, backtraceSet) => (
    !editionDefault || backtraceSet
  ),
);

export const hasProperties = (obj: {}) => Object.values(obj).some(val => !!val);

const getOutputs = (state: State) => [
  state.output.assembly,
  state.output.clippy,
  state.output.execute,
  state.output.format,
  state.output.gist,
  state.output.llvmIr,
  state.output.mir,
  state.output.hir,
  state.output.miri,
  state.output.macroExpansion,
  state.output.wasm,
];

export const getSomethingToShow = createSelector(
  getOutputs,
  a => a.some(hasProperties),
);

export const baseUrlSelector = (state: State) =>
  state.globalConfiguration.baseUrl;

const excessiveExecutionTimeSSelector = (state: State) =>
  state.globalConfiguration.excessiveExecutionTimeS;

const killGracePeriodSSelector = (state: State) =>
  state.globalConfiguration.killGracePeriodS;

export const killGracePeriodMsSelector = createSelector(
  killGracePeriodSSelector,
  (t) => t * 1000,
);

const formatSeconds = (seconds: number) => {
  if (seconds === 1) {
    return '1 second';
  } else if (seconds % 1 === 0) {
    return `${seconds.toFixed(0)} seconds`;
  } else {
    return `${seconds.toFixed(1)} seconds`;
  }
};

export const excessiveExecutionTimeSelector = createSelector(
  excessiveExecutionTimeSSelector,
  formatSeconds,
);

export const killGracePeriodTimeSelector = createSelector(
  killGracePeriodSSelector,
  formatSeconds,
);

export const currentExecutionSequenceNumberSelector = (state: State) =>
  state.output.execute.sequenceNumber;

export const excessiveExecutionSelector = createSelector(
  (state: State) => state.output.execute,
  excessiveExecutionTimeSSelector,
  (e, limit) =>
    e.requestsInProgress > 0 &&
    !e.allowLongRun &&
    (e.totalTimeSecs ?? 0.0) >= limit,
);

const gistSelector = (state: State) =>
  state.output.gist;

// Selects url.query of build configs.
const urlQuerySelector = createSelector(
  gistSelector,
  gist => {
    const res = new URLSearchParams();
    if (gist.channel) { res.set('version', gist.channel) }
    if (gist.mode) { res.set('mode', gist.mode) }
    if (gist.edition) { res.set('edition', gist.edition) }
    return res;
  },
);

export const showGistLoaderSelector = createSelector(
  gistSelector,
  gist => gist.requestsInProgress > 0,
);

export const permalinkSelector = createSelector(
  baseUrlSelector, urlQuerySelector, gistSelector,
  (baseUrl, originalQuery, gist) => {
    const u = new URL(baseUrl);
    const query = new URLSearchParams(originalQuery);
    if (gist.id) { query.set('gist', gist.id) }
    u.search = query.toString();
    return u.href;
  },
);

export const textChangedSinceShareSelector = createSelector(
  codeSelector, gistSelector,
  (code, gist) => code !== gist.code
)

const codeBlock = (code: string, language = '') =>
  '```' + language + `\n${code}\n` + '```';

const maybeOutput = (code: string | undefined, whenPresent: (_: string) => void) => {
  if (code && code.length !== 0) { whenPresent(code); }
};

const snippetSelector = createSelector(
  gistSelector, permalinkSelector,
  (gist, permalink) => {
    let snippet = '';

    maybeOutput(gist.code, code => {
      snippet += source`
        ${codeBlock(code, 'rust')}

        ([Playground](${permalink}))
      `;
    });

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
    const newUsersPostUrl = new URL('https://users.rust-lang.org/new-topic');
    newUsersPostUrl.searchParams.set('body', snippet);
    return newUsersPostUrl.href;
  },
);

export const codeUrlSelector = createSelector(
  baseUrlSelector, urlQuerySelector, gistSelector,
  (baseUrl, originalQuery, gist) => {
    const u = new URL(baseUrl);
    const query = new URLSearchParams(originalQuery);
    if (gist.code) { query.set('code', gist.code) }
    u.search = new URLSearchParams(query).toString();
    return u.href;
  },
);

const notificationsSelector = (state: State) => state.notifications;

const NOW = new Date();

const RUST_SURVEY_2023_END = new Date('2024-01-15T00:00:00Z');
const RUST_SURVEY_2023_OPEN = NOW <= RUST_SURVEY_2023_END;
export const showRustSurvey2023Selector = createSelector(
  notificationsSelector,
  notifications => RUST_SURVEY_2023_OPEN && !notifications.seenRustSurvey2023,
);

export const anyNotificationsToShowSelector = createSelector(
  showRustSurvey2023Selector,
  excessiveExecutionSelector,
  (...allNotifications) => allNotifications.some(n => n),
);

export const clippyRequestSelector = createSelector(
  channelSelector,
  getCrateType,
  editionSelector,
  codeSelector,
  cargoScriptSelector,
  (channel, crateType, edition, code, cargoScript) => ({ channel, crateType, edition, code, cargoScript }),
);

export const formatRequestSelector = createSelector(
  channelSelector,
  editionSelector,
  codeSelector,
  cargoScriptSelector,
  (channel, edition, code, cargoScript) => ({ channel, edition, code, cargoScript }),
);

export const miriRequestSelector = createSelector(
  editionSelector,
  codeSelector,
  cargoScriptSelector,
  (edition, code, cargoScript) => ({ edition, code, cargoScript }),
);

export const macroExpansionRequestSelector = createSelector(
  editionSelector,
  codeSelector,
  cargoScriptSelector,
  (edition, code, cargoScript) => ({ edition, code, cargoScript })
);

const focus = (state: State) => state.output.meta.focus;
export const isOutputFocused = createSelector(
  focus,
  (focus) => !!focus,
);

export const showStdinSelector = createSelector(
  focus,
  (focus) => focus == Focus.Execute,
)
export const enableStdinSelector = createSelector(
  (state: State) => state.output.execute.requestsInProgress,
  (req) => req > 0,
)

const orientationConfig = (state: State) => state.configuration.orientation;
const browserWidthIsSmall = (state: State) => state.browser.isSmall;

export const orientation = createSelector(
  orientationConfig,
  browserWidthIsSmall,
  (orientation, widthIsSmall) => {
    if (orientation == Orientation.Automatic) {
      if (widthIsSmall) { return Orientation.Horizontal } else { return Orientation.Vertical }
    } else {
      return orientation;
    }
  }
)

const aceConfig = (s: State) => s.configuration.ace;
export const aceKeybinding = createSelector(aceConfig, c => c.keybinding);
export const acePairCharacters = createSelector(aceConfig, c => c.pairCharacters);
export const aceTheme = createSelector(aceConfig, c => c.theme);

export const offerCrateAutocompleteOnUse = createSelector(
  editionSelector,
  (edition) => edition !== Edition.Rust2015,
);

const client = (state: State) => state.client;
const featureFlags = (state: State) => state.featureFlags;
const websocket = (state: State) => state.websocket;

const clientFeatureFlagThreshold = createSelector(client, (c) => c.featureFlagThreshold);

const showGemThreshold = createSelector(featureFlags, ff => ff.showGemThreshold);

const createFeatureFlagSelector = (ff: (state: State) => number) =>
  createSelector(clientFeatureFlagThreshold, ff, (c, ff) => c <= ff);

export const showGemSelector = createFeatureFlagSelector(showGemThreshold);

export const executeViaWebsocketSelector = createSelector(websocket, (ws) => ws.connected);

export type WebSocketStatus =
  { state: 'disconnected' } |
  { state: 'connected' } |
  { state: 'error', error: string };

export const websocketStatusSelector = createSelector(
  websocket,
  (ws): WebSocketStatus => {
    if (ws.error) { return { state: 'error', error: ws.error }; }
    if (ws.connected) { return { state: 'connected' }; }
    return { state: 'disconnected' };
  }
);

export const executeRequestPayloadSelector = createSelector(
  codeSelector,
  channelSelector,
  (state: State) => state.configuration,
  getBacktraceSet,
  (_state: State, { crateType, tests }: { crateType: string, tests: boolean }) => ({ crateType, tests }),
  cargoScriptSelector,
  (code, channel, configuration, backtrace, { crateType, tests }, cargoScript) => ({
    channel,
    mode: configuration.mode,
    edition: configuration.edition,
    crateType,
    tests,
    code,
    backtrace,
    cargoScript
  }),
);

export const compileRequestPayloadSelector = createSelector(
  codeSelector,
  channelSelector,
  (state: State) => state.configuration,
  getCrateType,
  runAsTest,
  getBacktraceSet,
  (_state: State, { target }: { target: string }) => ({ target }),
  cargoScriptSelector,
  (code, channel, configuration, crateType, tests, backtrace, { target }, cargoScript) => ({
    channel,
    mode: configuration.mode,
    edition: configuration.edition,
    crateType,
    tests,
    code,
    target,
    assemblyFlavor: configuration.assemblyFlavor,
    demangleAssembly: configuration.demangleAssembly,
    processAssembly: configuration.processAssembly,
    backtrace,
    cargoScript
  }),
);
