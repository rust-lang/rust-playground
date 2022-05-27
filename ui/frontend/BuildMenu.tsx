import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';

import * as actions from './actions';
import * as selectors from './selectors';
import { useAppDispatch } from './configureStore';

import ButtonMenuItem from './ButtonMenuItem';
import MenuGroup from './MenuGroup';
import MenuAside from './MenuAside';

import styles from './BuildMenu.module.css';

interface BuildMenuProps {
  close: () => void;
}

const useDispatchAndClose = (action: () => actions.ThunkAction, close: () => void) => {
  const dispatch = useAppDispatch();

  return useCallback(
    () => {
      dispatch(action());
      close();
    },
    [action, close, dispatch]
  );
}

const BuildMenu: React.FC<BuildMenuProps> = props => {
  const isHirAvailable = useSelector(selectors.isHirAvailable);
  const isWasmAvailable = useSelector(selectors.isWasmAvailable);

  const compile = useDispatchAndClose(actions.performCompile, props.close);
  const compileToAssembly = useDispatchAndClose(actions.performCompileToAssembly, props.close);
  const compileToLLVM = useDispatchAndClose(actions.performCompileToLLVM, props.close);
  const compileToMir = useDispatchAndClose(actions.performCompileToMir, props.close);
  const compileToHir = useDispatchAndClose(actions.performCompileToNightlyHir, props.close);
  const compileToWasm = useDispatchAndClose(actions.performCompileToNightlyWasm, props.close);
  const execute = useDispatchAndClose(actions.performExecute, props.close);
  const test = useDispatchAndClose(actions.performTest, props.close);

  return (
    <MenuGroup title="What do you want to do?">
      <ButtonMenuItem name="Run" onClick={execute}>
        Build and run the code, showing the output.
        Equivalent to <code className={styles.code}>cargo run</code>.
      </ButtonMenuItem>
      <ButtonMenuItem name="Build" onClick={compile}>
        Build the code without running it.
        Equivalent to <code className={styles.code}>cargo build</code>.
      </ButtonMenuItem>
      <ButtonMenuItem name="Test" onClick={test}>
        Build the code and run all the tests.
        Equivalent to <code className={styles.code}>cargo test</code>.
      </ButtonMenuItem>
      <ButtonMenuItem name="ASM" onClick={compileToAssembly}>
        Build and show the resulting assembly code.
      </ButtonMenuItem>
      <ButtonMenuItem name="LLVM IR" onClick={compileToLLVM}>
        Build and show the resulting LLVM IR, LLVM’s intermediate representation.
      </ButtonMenuItem>
      <ButtonMenuItem name="MIR" onClick={compileToMir}>
        Build and show the resulting MIR, Rust’s control-flow-based intermediate representation.
      </ButtonMenuItem>
      <ButtonMenuItem name="HIR" onClick={compileToHir}>
        Build and show the resulting HIR, Rust’s syntax-based intermediate representation.
        {!isHirAvailable && <HirAside />}
      </ButtonMenuItem>
      <ButtonMenuItem name="WASM" onClick={compileToWasm}>
        Build a WebAssembly module for web browsers, in the .WAT textual representation.
        {!isWasmAvailable && <WasmAside />}
      </ButtonMenuItem>
    </MenuGroup>
  );
};

const HirAside: React.FC = () => (
  <MenuAside>
    Note: HIR currently requires using the Nightly channel, selecting this
    option will switch to Nightly.
  </MenuAside>
);

const WasmAside: React.FC = () => (
  <MenuAside>
    Note: WASM currently requires using the Nightly channel, selecting this
    option will switch to Nightly.
  </MenuAside>
);

export default BuildMenu;
