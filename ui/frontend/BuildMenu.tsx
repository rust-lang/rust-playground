import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import * as actions from './actions';
import * as selectors from './selectors';

import ButtonMenuItem from './ButtonMenuItem';
import MenuGroup from './MenuGroup';

interface BuildMenuProps {
  close: () => void;
}

const useDispatchAndClose = (action: () => void, close: () => void) => {
  const dispatch = useDispatch();

  return useCallback(
    () => {
      dispatch(action());
      close();
    },
    [action, close, dispatch]
  );
}

const BuildMenu: React.SFC<BuildMenuProps> = props => {
  const isWasmAvailable = useSelector(selectors.isWasmAvailable);

  const compile = useDispatchAndClose(actions.performCompile, props.close);
  const compileToAssembly = useDispatchAndClose(actions.performCompileToAssembly, props.close);
  const compileToLLVM = useDispatchAndClose(actions.performCompileToLLVM, props.close);
  const compileToMir = useDispatchAndClose(actions.performCompileToMir, props.close);
  const compileToWasm = useDispatchAndClose(actions.performCompileToNightlyWasm, props.close);
  const execute = useDispatchAndClose(actions.performExecute, props.close);
  const test = useDispatchAndClose(actions.performTest, props.close);

  return (
    <MenuGroup title="What do you want to do?">
      <ButtonMenuItem name="Run" onClick={execute}>
        Build and run the code, showing the output.
        Equivalent to <code className="build-menu__code">cargo run</code>.
      </ButtonMenuItem>
      <ButtonMenuItem name="Build" onClick={compile}>
        Build the code without running it.
        Equivalent to <code className="build-menu__code">cargo build</code>.
      </ButtonMenuItem>
      <ButtonMenuItem name="Test" onClick={test}>
        Build the code and run all the tests.
        Equivalent to <code className="build-menu__code">cargo test</code>.
      </ButtonMenuItem>
      <ButtonMenuItem name="ASM" onClick={compileToAssembly}>
        Build and show the resulting assembly code.
      </ButtonMenuItem>
      <ButtonMenuItem name="LLVM IR" onClick={compileToLLVM}>
        Build and show the resulting LLVM IR, LLVM’s intermediate representation.
      </ButtonMenuItem>
      <ButtonMenuItem name="MIR" onClick={compileToMir}>
        Build and show the resulting MIR, Rust’s intermediate representation.
      </ButtonMenuItem>
      <ButtonMenuItem name="WASM" onClick={compileToWasm}>
        Build a WebAssembly module for web browsers, in the .WAT textual representation.
        {!isWasmAvailable && <WasmAside />}
      </ButtonMenuItem>
    </MenuGroup>
  );
};

const WasmAside: React.SFC = () => (
  <p className="build-menu__aside">
    Note: WASM currently requires using the Nightly channel, selecting this
    option will switch to Nightly.
  </p>
);

export default BuildMenu;
