import React, { Fragment, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import MenuGroup from './MenuGroup';
import SelectOne from './SelectOne';

import * as actions from './actions';
import State from './state';
import { Mode } from './types';

interface ModeMenuProps {
  close: () => void;
}

const ModeMenu: React.FC<ModeMenuProps> = props => {
  const mode = useSelector((state: State) => state.configuration.mode);
  const dispatch = useDispatch();
  const changeMode = useCallback((mode: Mode) => {
    dispatch(actions.changeMode(mode));
    props.close();
  }, [dispatch, props]
  );

  return (
    <Fragment>
      <MenuGroup title="Mode &mdash; Choose optimization level">
        <SelectOne
          name="Debug"
          currentValue={mode}
          thisValue={Mode.Debug}
          changeValue={changeMode}
        >
          Build with debug information, without optimizations.
        </SelectOne>
        <SelectOne
          name="Release"
          currentValue={mode}
          thisValue={Mode.Release}
          changeValue={changeMode}
        >
          Build with optimizations turned on.
        </SelectOne>
      </MenuGroup>
    </Fragment>
  );
};

export default ModeMenu;
