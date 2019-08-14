import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import * as actions from './actions';
import { State } from './reducers';
import { Focus } from './types';

import Execute from './Output/Execute';
import Gist from './Output/Gist';
import Section from './Output/Section';
import SimplePane, { SimplePaneProps } from './Output/SimplePane';
import * as selectors from './selectors';

const Tab: React.SFC<TabProps> = ({ kind, focus, label, onClick, tabProps }) => {
  if (selectors.hasProperties(tabProps)) {
    const selected = focus === kind ? 'output-tab-selected' : '';
    return (
      <button className={`output-tab ${selected}`}
        onClick={onClick}>
        {label}
      </button>
    );
  } else {
    return null;
  }
};

interface TabProps {
  kind: Focus;
  focus?: Focus;
  label: string;
  onClick: () => any;
  tabProps: object;
}

const PaneWithCode: React.SFC<PaneWithCodeProps> = ({ code, ...rest }) => (
  <SimplePane {...rest}>
    <Section kind="code" label="Result">{code}</Section>
  </SimplePane>
);

interface PaneWithCodeProps extends SimplePaneProps {
  code?: string;
}

const Output: React.SFC = () => {
  const somethingToShow = useSelector(selectors.getSomethingToShow);
  const { meta: { focus }, execute, format, clippy, miri, assembly, llvmIr, mir, wasm, gist } =
    useSelector((state: State) => state.output);

  const dispatch = useDispatch();
  const focusClose = useCallback(() => dispatch(actions.changeFocus(null)), [dispatch]);
  const focusExecute = useCallback(() => dispatch(actions.changeFocus(Focus.Execute)), [dispatch]);
  const focusFormat = useCallback(() => dispatch(actions.changeFocus(Focus.Format)), [dispatch]);
  const focusClippy = useCallback(() => dispatch(actions.changeFocus(Focus.Clippy)), [dispatch]);
  const focusMiri = useCallback(() => dispatch(actions.changeFocus(Focus.Miri)), [dispatch]);
  const focusAssembly = useCallback(() => dispatch(actions.changeFocus(Focus.Asm)), [dispatch]);
  const focusLlvmIr = useCallback(() => dispatch(actions.changeFocus(Focus.LlvmIr)), [dispatch]);
  const focusMir = useCallback(() => dispatch(actions.changeFocus(Focus.Mir)), [dispatch]);
  const focusWasm = useCallback(() => dispatch(actions.changeFocus(Focus.Wasm)), [dispatch]);
  const focusGist = useCallback(() => dispatch(actions.changeFocus(Focus.Gist)), [dispatch]);

  if (!somethingToShow) {
    return null;
  }

  let close = null;
  let body = null;
  if (focus) {
    close = (
      <button className="output-tab output-tab-close"
        onClick={focusClose}>Close</button>
    );

    body = (
      <div className="output-body">
        {focus === Focus.Execute && <Execute />}
        {focus === Focus.Format && <SimplePane {...format} kind="format" />}
        {focus === Focus.Clippy && <SimplePane {...clippy} kind="clippy" />}
        {focus === Focus.Miri && <SimplePane {...miri} kind="miri" />}
        {focus === Focus.Asm && <PaneWithCode {...assembly} kind="asm" />}
        {focus === Focus.LlvmIr && <PaneWithCode {...llvmIr} kind="llvm-ir" />}
        {focus === Focus.Mir && <PaneWithCode {...mir} kind="mir" />}
        {focus === Focus.Wasm && <PaneWithCode {...wasm} kind="wasm" />}
        {focus === Focus.Gist && <Gist />}
      </div>
    );
  }

  return (
    <div className="output">
      <div className="output-tabs">
        <Tab kind={Focus.Execute} focus={focus}
          label="Execution"
          onClick={focusExecute}
          tabProps={execute} />
        <Tab kind={Focus.Format} focus={focus}
          label="Format"
          onClick={focusFormat}
          tabProps={format} />
        <Tab kind={Focus.Clippy} focus={focus}
          label="Clippy"
          onClick={focusClippy}
          tabProps={clippy} />
        <Tab kind={Focus.Miri} focus={focus}
          label="Miri"
          onClick={focusMiri}
          tabProps={miri} />
        <Tab kind={Focus.Asm} focus={focus}
          label="ASM"
          onClick={focusAssembly}
          tabProps={assembly} />
        <Tab kind={Focus.LlvmIr} focus={focus}
          label="LLVM IR"
          onClick={focusLlvmIr}
          tabProps={llvmIr} />
        <Tab kind={Focus.Mir} focus={focus}
          label="MIR"
          onClick={focusMir}
          tabProps={mir} />
        <Tab kind={Focus.Wasm} focus={focus}
          label="WASM"
          onClick={focusWasm}
          tabProps={wasm} />
        <Tab kind={Focus.Gist} focus={focus}
          label="Share"
          onClick={focusGist}
          tabProps={gist} />
        {close}
      </div>
      {body}
    </div>
  );
};

export default Output;
