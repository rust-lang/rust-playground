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

const getStable = (state: State) => state.versions && state.versions.stable;
const getBeta = (state: State) => state.versions && state.versions.beta;
const getNightly = (state: State) => state.versions && state.versions.nightly;

export const stableVersionText = createSelector([getStable], v => v ? v.version : '');

const nonStable = v => v ? `${v.version} (${v.date} ${v.hash})` : '';
export const betaVersionText = createSelector([getBeta], nonStable);
export const nightlyVersionText = createSelector([getNightly], nonStable);

export const isWasmAvailable = (state: State) => (
  state.configuration.channel === Channel.Nightly
);
