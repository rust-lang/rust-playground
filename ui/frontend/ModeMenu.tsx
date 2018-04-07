import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import MenuGroup from './MenuGroup';
import SelectOne from './SelectOne';

import { changeMode } from './actions';
import State from './state';
import { Mode } from './types';

interface ModeMenuProps {
  mode: Mode;
  changeMode: (_: Mode) => any;
  close: () => void;
}

const ModeMenu: React.SFC<ModeMenuProps> = props => (
  <Fragment>
    <MenuGroup title="Mode &mdash; Choose optimization level">
      <SelectOne
        name="Debug"
        currentValue={props.mode}
        thisValue={Mode.Debug}
        changeValue={mode => { props.changeMode(mode); props.close(); }}
      >
        Build with debug information, without optimizations.
      </SelectOne>
      <SelectOne
        name="Release"
        currentValue={props.mode}
        thisValue={Mode.Release}
        changeValue={mode => { props.changeMode(mode); props.close(); }}
      >
        Build with optimizations turned on.
      </SelectOne>
    </MenuGroup>
  </Fragment>
);

const mapStateToProps = (state: State) => {
  const { configuration: { mode } } = state;

  return {
    mode,
  };
};

const mapDispatchToProps = {
  changeMode,
};

export default connect(mapStateToProps, mapDispatchToProps)(ModeMenu);
