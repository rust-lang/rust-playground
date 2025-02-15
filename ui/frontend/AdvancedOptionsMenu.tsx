import React, { useCallback } from 'react';

import * as config from './reducers/configuration';
import { Either as EitherConfig, Select as SelectConfig } from './ConfigElement';
import MenuGroup from './MenuGroup';
import * as selectors from './selectors';
import { Backtrace, Channel, Edition, AliasingModel } from './types';
import { useAppDispatch, useAppSelector } from './hooks';

const AdvancedOptionsMenu: React.FC = () => {
  const isEditionDefault = useAppSelector(selectors.isEditionDefault);
  const edition = useAppSelector((state) => state.configuration.edition);
  const isBacktraceSet = useAppSelector(selectors.getBacktraceSet);
  const backtrace = useAppSelector((state) => state.configuration.backtrace);
  const isAliasingModelDefault = useAppSelector(selectors.isAliasingModelDefault);
  const aliasingModel = useAppSelector((state) => state.configuration.aliasingModel);

  const dispatch = useAppDispatch();

  const changeEdition = useCallback((e: Edition) => dispatch(config.changeEdition(e)), [dispatch]);
  const changeBacktrace = useCallback((b: Backtrace) => dispatch(config.changeBacktrace(b)), [dispatch]);
  const changeAliasingModel = useCallback((b: AliasingModel) => dispatch(config.changeAliasingModel(b)), [dispatch]);

  const channel  = useAppSelector((state) => state.configuration.channel);
  const switchText = (channel !== Channel.Nightly) ? ' (will select nightly Rust)' : '';

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
        <option value={Edition.Rust2024}>2024{switchText}</option>
      </SelectConfig>

      <EitherConfig
        id="backtrace"
        name="Backtrace"
        a={Backtrace.Disabled}
        b={Backtrace.Enabled}
        value={backtrace}
        isNotDefault={isBacktraceSet}
        onChange={changeBacktrace} />

      <EitherConfig
        id="aliasingModel"
        name="Aliasing model"
        a={AliasingModel.Stacked}
        b={AliasingModel.Tree}
        value={aliasingModel}
        isNotDefault={!isAliasingModelDefault}
        onChange={changeAliasingModel} />

    </MenuGroup>
  );
};

export default AdvancedOptionsMenu;
