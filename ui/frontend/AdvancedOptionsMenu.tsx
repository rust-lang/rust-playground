import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import * as actions from './actions';
import { Either as EitherConfig } from './ConfigElement';
import MenuGroup from './MenuGroup';
import { State } from './reducers';
import * as selectors from './selectors';
import { Backtrace, Edition } from './types';

const AdvancedOptionsMenu: React.SFC = () => {
  const isEditionSet = useSelector(selectors.getEditionSet);
  const edition = useSelector((state: State) => state.configuration.edition);
  const isBacktraceSet = useSelector(selectors.getBacktraceSet);
  const backtrace = useSelector((state: State) => state.configuration.backtrace);

  const dispatch = useDispatch();

  const changeEdition = useCallback((e) => dispatch(actions.changeEdition(e)), [dispatch]);
  const changeBacktrace = useCallback((b) => dispatch(actions.changeBacktrace(b)), [dispatch]);

  return (
    <MenuGroup title="Advanced options">
      <EitherConfig
        id="edition"
        name="Edition"
        a={Edition.Rust2015}
        b={Edition.Rust2018}
        value={edition}
        isNotDefault={isEditionSet}
        onChange={changeEdition} />

      <EitherConfig
        id="backtrace"
        name="Backtrace"
        a={Backtrace.Disabled}
        b={Backtrace.Enabled}
        value={backtrace}
        isNotDefault={isBacktraceSet}
        onChange={changeBacktrace} />
    </MenuGroup>
  );
};

export default AdvancedOptionsMenu;
