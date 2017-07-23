import { createSelector } from 'reselect';

const getCode = state => state.code;

const hasTests = code => code.includes('#[test]');
const hasMainMethod = code => code.includes('fn main()');
const runAsTestRaw = code => hasTests(code) && !hasMainMethod(code);
export const runAsTest = createSelector([getCode], runAsTestRaw);

const CRATE_TYPE_RE = /^\s*#!\s*\[\s*crate_type\s*=\s*"([^"]*)"\s*]/m;
const getCrateTypeRaw = code => (code.match(CRATE_TYPE_RE) || [null, 'bin'])[1];
export const getCrateType = createSelector([getCode], getCrateTypeRaw);
