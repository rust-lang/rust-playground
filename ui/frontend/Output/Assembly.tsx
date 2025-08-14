import React from 'react';

import { useAppSelector } from '../hooks';
import * as selectors from '../selectors';
import PaneWithCode from './PaneWithCode';
import Section from './Section';

const Assembly: React.FC = () => {
  const assembly = useAppSelector((state) => state.output.assembly);
  const isAssemblyInProgress = useAppSelector(selectors.isAssemblyInProgressSelector);
  const hasAssemblySymbols = useAppSelector(selectors.hasAssemblySymbolsSelector);

  const warnAboutNoSymbols = !isAssemblyInProgress && !hasAssemblySymbols;

  return (
    <PaneWithCode {...assembly} kind="asm">
      {warnAboutNoSymbols ? (
        <Section kind="warning" label="Warnings">
          No symbols detected — they may have been optimized away.
          {'\n'}
          Add the <code>#[unsafe(no_mangle)]</code> attribute to
          {'\n'}
          functions you want to see assembly for. Generic functions
          {'\n'}
          only generate assembly when concrete types are provided.
        </Section>
      ) : null}
    </PaneWithCode>
  );
};

export default Assembly;
