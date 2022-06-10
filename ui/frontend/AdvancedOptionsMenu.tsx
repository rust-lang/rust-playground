import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import * as actions from './actions';
import { Either as EitherConfig, Select as SelectConfig } from './ConfigElement';
import MenuGroup from './MenuGroup';
import { State } from './reducers';
import * as selectors from './selectors';
import { Backtrace, Edition } from './types';

const AdvancedOptionsMenu: React.FC = () => {
  const isEditionDefault = useSelector(selectors.isEditionDefault);
  const edition = useSelector((state: State) => state.configuration.edition);
  const isBacktraceSet = useSelector(selectors.getBacktraceSet);
  const backtrace = useSelector((state: State) => state.configuration.backtrace);

  const dispatch = useDispatch();

  const changeEdition = useCallback((e) => dispatch(actions.changeEdition(e)), [dispatch]);
  const changeBacktrace = useCallback((b) => dispatch(actions.changeBacktrace(b)), [dispatch]);

  return (
    <MenuGroup title="Advanced options">
      <SelectConfig
        name="Edition"
        value={edition}
        isNotDefault={!isEditionDefault}
        onChange={changeEdition}
      >
        <option value={Edition.Rust2015}>2015</option>
        <option value={Edition.Rust2018}>2018</option>
        <option value={Edition.Rust2021}>2021</option>
      </SelectConfig>

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
