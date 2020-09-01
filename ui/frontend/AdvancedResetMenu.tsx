import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import ButtonMenuItem from './ButtonMenuItem';
import MenuGroup from './MenuGroup';

import * as selectors from './selectors';
import * as actions from './actions';

interface AdvancedResetMenuProps {
  close: () => void;
}

const AdvancedResetMenu: React.SFC<AdvancedResetMenuProps> = props => {
  const dispatch = useDispatch();
  const resetToMinimal = useCallback(() => {
    dispatch(actions.resetEditorToMinimal());
    props.close();
  }, [dispatch, props]);
  const resetToHello = useCallback(() => {
    dispatch(actions.resetEditorToHello());
    props.close();
  }, [dispatch, props]);

  return (
    <MenuGroup title="Reset Editor">
      <ButtonMenuItem name="Reset to a minimal executable code" onClick={resetToMinimal}>
        <div>Reset the editor content with just an empty main function.</div>
      </ButtonMenuItem>
      <ButtonMenuItem name='Reset to an "Hello World"' onClick={resetToHello}>
        <div>Reset the editor content with an "Hello World" executable.</div>
      </ButtonMenuItem>
    </MenuGroup>
  );
};

export default AdvancedResetMenu;
