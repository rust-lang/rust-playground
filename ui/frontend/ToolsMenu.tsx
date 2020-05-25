import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import ButtonMenuItem from './ButtonMenuItem';
import MenuGroup from './MenuGroup';

import * as selectors from './selectors';
import * as actions from './actions';

interface ToolsMenuProps {
  close: () => void;
}

const ToolsMenu: React.SFC<ToolsMenuProps> = props => {
  const rustfmtVersion = useSelector(selectors.rustfmtVersionText);
  const rustfmtVersionDetails = useSelector(selectors.rustfmtVersionDetailsText);
  const clippyVersionDetails = useSelector(selectors.clippyVersionDetailsText);
  const clippyVersion = useSelector(selectors.clippyVersionText);
  const miriVersionDetails = useSelector(selectors.miriVersionDetailsText);
  const miriVersion = useSelector(selectors.miriVersionText);
  const nightlyVersion = useSelector(selectors.nightlyVersionText);
  const nightlyVersionDetails = useSelector(selectors.nightlyVersionDetailsText);

  const dispatch = useDispatch();
  const clippy = useCallback(() => {
    dispatch(actions.performClippy());
    props.close();
  }, [dispatch, props]);
  const miri = useCallback(() => {
    dispatch(actions.performMiri());
    props.close();
  }, [dispatch, props]);
  const format = useCallback(() => {
    dispatch(actions.performFormat());
    props.close();
  }, [dispatch, props]);
  const expandMacros = useCallback(() => {
    dispatch(actions.performMacroExpansion());
    props.close();
  }, [dispatch, props]);

  return (
    <MenuGroup title="Tools">
      <ButtonMenuItem
        name="Rustfmt"
        onClick={format}>
        <div>Format this code with Rustfmt.</div>
        <div className="tools-menu__aside">{rustfmtVersion} ({rustfmtVersionDetails})</div>
      </ButtonMenuItem>
      <ButtonMenuItem
        name="Clippy"
        onClick={clippy}>
        <div>Catch common mistakes and improve the code using the Clippy linter.</div>
        <div className="tools-menu__aside">{clippyVersion} ({clippyVersionDetails})</div>
      </ButtonMenuItem>
      <ButtonMenuItem
        name="Miri"
        onClick={miri}>
        <div>
          Execute this program in the Miri interpreter to detect certain
          cases of undefined behavior (like out-of-bounds memory access).
        </div>
        <div className="tools-menu__aside">{miriVersion} ({miriVersionDetails})</div>
      </ButtonMenuItem>
      <ButtonMenuItem
        name="Expand macros"
        onClick={expandMacros}>
        <div>
          Expand macros in code using the nightly compiler.
        </div>
        <div className="tools-menu__aside">{nightlyVersion} ({nightlyVersionDetails})</div>
      </ButtonMenuItem>
    </MenuGroup>
  );
};

export default ToolsMenu;
