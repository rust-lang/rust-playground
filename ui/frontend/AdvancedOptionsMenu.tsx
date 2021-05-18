import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import * as actions from './actions';
import { Either as EitherConfig, Select as SelectConfig } from './ConfigElement';
import MenuGroup from './MenuGroup';
import MenuAside from './MenuAside';
import { State } from './reducers';
import * as selectors from './selectors';
import { Backtrace, Edition } from './types';

const AdvancedOptionsMenu: React.SFC = () => {
  const isEditionDefault = useSelector(selectors.isEditionDefault);
  const edition = useSelector((state: State) => state.configuration.edition);
  const isRust2021Available = useSelector(selectors.isRust2021Available);
  const isBacktraceSet = useSelector(selectors.getBacktraceSet);
  const backtrace = useSelector((state: State) => state.configuration.backtrace);

  const dispatch = useDispatch();

  const changeEdition = useCallback((e) => dispatch(actions.changeEdition(e)), [dispatch]);
  const changeBacktrace = useCallback((b) => dispatch(actions.changeBacktrace(b)), [dispatch]);

  const Aside = !isRust2021Available && <Rust2021Aside />;

  return (
    <MenuGroup title="Advanced options">
      <SelectConfig
        name="Edition"
        value={edition}
        isNotDefault={!isEditionDefault}
        onChange={changeEdition}
        aside={Aside}
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

const Rust2021Aside: React.SFC = () => (
  <MenuAside>
    Note: Rust 2021 currently requires using the Nightly channel, selecting this
    option will switch to Nightly.
  </MenuAside>
);

export default AdvancedOptionsMenu;
