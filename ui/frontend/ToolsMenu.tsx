import React from 'react';
import { connect } from 'react-redux';

import ButtonMenuItem from './ButtonMenuItem';
import MenuGroup from './MenuGroup';

import {
  performClippy,
  performFormat,
} from './actions';
import State from './state';

interface ToolsMenuProps {
  clippy: () => any;
  format: () => any;
  close: () => void;
}

const ToolsMenu: React.SFC<ToolsMenuProps> = props => (
  <MenuGroup title="Tools">
    <ButtonMenuItem
      name="Rustfmt"
      onClick={() => { props.format(); props.close(); }}>
      Format this code with Rustfmt.
    </ButtonMenuItem>
    <ButtonMenuItem
      name="Clippy"
      onClick={() => { props.clippy(); props.close(); }}>
      Catch common mistakes and improve the code using the Clippy linter.
    </ButtonMenuItem>
  </MenuGroup>
);

const mapDispatchToProps = ({
  clippy: performClippy,
  format: performFormat,
});

export default connect(undefined, mapDispatchToProps)(ToolsMenu);
