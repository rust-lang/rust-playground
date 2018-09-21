import React from 'react';
import { connect } from 'react-redux';

import ButtonMenuItem from './ButtonMenuItem';
import MenuGroup from './MenuGroup';

import {
  clippyVersionDetailsText,
  clippyVersionText,
  miriVersionDetailsText,
  miriVersionText,
  rustfmtVersionDetailsText,
  rustfmtVersionText,
} from './selectors';
import State from './state';

import {
  performClippy,
  performFormat,
  performMiri,
} from './actions';

interface ToolsMenuProps {
  rustfmtVersion: string;
  rustfmtVersionDetails: string;
  clippyVersion: string;
  clippyVersionDetails: string;
  miriVersionDetails: string;
  miriVersion: string;
  clippy: () => any;
  miri: () => any;
  format: () => any;
  close: () => void;
}

const ToolsMenu: React.SFC<ToolsMenuProps> = props => (
  <MenuGroup title="Tools">
    <ButtonMenuItem
      name="Rustfmt"
      onClick={() => { props.format(); props.close(); }}>
      <div>Format this code with Rustfmt.</div>
      <div className="tools-menu__aside">{props.rustfmtVersion} ({props.rustfmtVersionDetails})</div>
    </ButtonMenuItem>
    <ButtonMenuItem
      name="Clippy"
      onClick={() => { props.clippy(); props.close(); }}>
      <div>Catch common mistakes and improve the code using the Clippy linter.</div>
      <div className="tools-menu__aside">{props.clippyVersion} ({props.clippyVersionDetails})</div>
    </ButtonMenuItem>
    <ButtonMenuItem
      name="Miri"
      onClick={() => { props.miri(); props.close(); }}>
      <div>
        Execute this program in the Miri interpreter to detect certain
        cases of undefined behavior (like out-of-bounds memory access).
      </div>
      <div className="tools-menu__aside">{props.miriVersion} ({props.miriVersionDetails})</div>
    </ButtonMenuItem>
  </MenuGroup>
);

const mapStateToProps = (state: State) => {
  return {
    rustfmtVersion: rustfmtVersionText(state),
    rustfmtVersionDetails: rustfmtVersionDetailsText(state),
    clippyVersionDetails: clippyVersionDetailsText(state),
    clippyVersion: clippyVersionText(state),
    miriVersionDetails: miriVersionDetailsText(state),
    miriVersion: miriVersionText(state),
  };
};

const mapDispatchToProps = ({
  clippy: performClippy,
  miri: performMiri,
  format: performFormat,
});

export default connect(mapStateToProps, mapDispatchToProps)(ToolsMenu);
