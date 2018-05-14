import { createSelector } from 'reselect';
import { State } from '../reducers';
import { Channel } from '../types';

const getCode = state => state.code;

const hasTests = code => code.includes('#[test]');
const hasMainMethod = code => code.includes('fn main()');
const runAsTestRaw = code => hasTests(code) && !hasMainMethod(code);
export const runAsTest = createSelector([getCode], runAsTestRaw);

const CRATE_TYPE_RE = /^\s*#!\s*\[\s*crate_type\s*=\s*"([^"]*)"\s*]/m;
const getCrateTypeRaw = code => (code.match(CRATE_TYPE_RE) || [null, 'bin'])[1];
export const getCrateType = createSelector([getCode], getCrateTypeRaw);

export const getExecutionLabel = createSelector([runAsTest, getCrateType], (tests, crateType) => {
  if (tests) { return 'Test'; }
  if (crateType === 'bin') { return 'Run'; }
  return 'Build';
});

const getStable = (state: State) => state.versions && state.versions.stable;
const getBeta = (state: State) => state.versions && state.versions.beta;
const getNightly = (state: State) => state.versions && state.versions.nightly;

const versionNumber = v => v ? v.version : '';
export const stableVersionText = createSelector([getStable], versionNumber);
export const betaVersionText = createSelector([getBeta], versionNumber);
export const nightlyVersionText = createSelector([getNightly], versionNumber);

const versionDetails = v => v ? `${v.date} ${v.hash.slice(0, 20)}` : '';
export const betaVersionDetailsText = createSelector([getBeta], versionDetails);
export const nightlyVersionDetailsText = createSelector([getNightly], versionDetails);

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
