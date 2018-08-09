import React from 'react';
import { connect } from 'react-redux';

import AdvancedOptionsMenu from './AdvancedOptionsMenu';
import BuildMenu from './BuildMenu';
import ChannelMenu from './ChannelMenu';
import ConfigMenu from './ConfigMenu';
import HeaderButton, { RightIcon as RightIconButton } from './HeaderButton';
import { BuildIcon, ConfigIcon, HelpIcon, MoreOptionsActiveIcon, MoreOptionsIcon } from './Icon';
import ModeMenu from './ModeMenu';
import PopButton, { PopButtonEnhancements } from './PopButton';
import { SegmentedButton, SegmentedButtonSet, SegmentedLink } from './SegmentedButton';
import ToolsMenu from './ToolsMenu';

import {
  navigateToHelp,
  performExecute,
  performGistSave,
} from './actions';
import {
  getAdvancedOptionsSet,
  getChannelLabel,
  getExecutionLabel,
  getModeLabel,
} from './selectors';
import State from './state';

interface HeaderProps {
  executionLabel: string;
  modeLabel: string;
  channelLabel: string;
  navigateToHelp: () => any;
  execute: () => any;
  gistSave: () => any;
  advancedOptionsSet: boolean;
}

const Header: React.SFC<HeaderProps> = props => (
  <div className="header">
    <HeaderSet id="build">
      <SegmentedButtonSet>
        <SegmentedButton isBuild onClick={props.execute}>
          <RightIconButton icon={<BuildIcon />}>
            {props.executionLabel}
          </RightIconButton>
        </SegmentedButton>
        <PopButton button={BuildMenuButton}>{({ popButtonClose }) => (
          <BuildMenu close={popButtonClose} />
        )}</PopButton>
      </SegmentedButtonSet>
    </HeaderSet>
    <HeaderSet id="channel-mode">
      <SegmentedButtonSet>
        <PopButton
          button={p => <ModeMenuButton label={props.modeLabel} {...p} />}>{({ popButtonClose }) => (
            <ModeMenu close={popButtonClose} />
          )}</PopButton>
        <PopButton
          button={p => <ChannelMenuButton label={props.channelLabel}{...p} />}>{({ popButtonClose }) => (
            <ChannelMenu close={popButtonClose} />
          )}</PopButton>
        <PopButton
          button={({ ...p }) => <AdvancedOptionsMenuButton advancedOptionsSet={props.advancedOptionsSet} {...p} />}
        >
          <AdvancedOptionsMenu />
        </PopButton>
      </SegmentedButtonSet>
    </HeaderSet>
    <HeaderSet id="share">
      <SegmentedButtonSet>
        <SegmentedButton title="Create shareable links to this code" onClick={props.gistSave}>
          <HeaderButton >Share</HeaderButton>
        </SegmentedButton>
      </SegmentedButtonSet>
    </HeaderSet>
    <HeaderSet id="tools">
      <SegmentedButtonSet>
        <PopButton button={ToolsMenuButton}>{({ popButtonClose }) => (
          <ToolsMenu close={popButtonClose} />
        )}</PopButton>
      </SegmentedButtonSet>
    </HeaderSet>
    <HeaderSet id="config">
      <SegmentedButtonSet>
        <PopButton button={ConfigMenuButton}>{({ popButtonClose }) => (
          <ConfigMenu close={popButtonClose} />
        )}</PopButton>
      </SegmentedButtonSet>
    </HeaderSet>
    <HeaderSet id="help">
      <SegmentedButtonSet>
        <SegmentedLink title="View help" action={props.navigateToHelp}>
          <HeaderButton icon={<HelpIcon />} />
        </SegmentedLink>
      </SegmentedButtonSet>
    </HeaderSet>
  </div >
);

interface HeaderSetProps {
  id: string;
}

const HeaderSet: React.SFC<HeaderSetProps> = ({ id, children }) => (
  <div className={`header__set header__set--${id}`}>{children}</div>
);

const BuildMenuButton: React.SFC<PopButtonEnhancements> = ({ popButtonProps }) => (
  <SegmentedButton title="Select what to build" {...popButtonProps}>
    <HeaderButton icon={<MoreOptionsIcon />} />
  </SegmentedButton>
);

interface ModeMenuButtonProps extends PopButtonEnhancements {
  label: string;
}

const ModeMenuButton: React.SFC<ModeMenuButtonProps> = ({ label, popButtonProps }) => (
  <SegmentedButton title="Mode &mdash; Choose the optimization level" {...popButtonProps}>
    <HeaderButton isExpandable>{label}</HeaderButton>
  </SegmentedButton>
);

interface ChannelMenuButtonProps extends PopButtonEnhancements {
  label: string;
}

const ChannelMenuButton: React.SFC<ChannelMenuButtonProps> = ({ label, popButtonProps }) => (
  <SegmentedButton title="Channel &mdash; Choose the Rust version"  {...popButtonProps}>
    <HeaderButton isExpandable>{label}</HeaderButton>
  </SegmentedButton>
);

interface AdvancedOptionsMenuButtonProps extends PopButtonEnhancements {
  advancedOptionsSet: boolean;
}

const AdvancedOptionsMenuButton: React.SFC<AdvancedOptionsMenuButtonProps> = props => (
  <SegmentedButton
    title="Advanced compilation flags"
    {...props.popButtonProps}>
    <HeaderButton icon={props.advancedOptionsSet ? <MoreOptionsActiveIcon /> : <MoreOptionsIcon />} />
  </SegmentedButton>
);

const ToolsMenuButton: React.SFC<PopButtonEnhancements> = ({ popButtonProps }) => (
  <SegmentedButton title="Run extra tools on the source code" {...popButtonProps}>
    <HeaderButton isExpandable>Tools</HeaderButton>
  </SegmentedButton>
);

const ConfigMenuButton: React.SFC<PopButtonEnhancements> = ({ popButtonProps }) => (
  <SegmentedButton title="Show the configuration options" {...popButtonProps}>
    <HeaderButton icon={<ConfigIcon />} isExpandable>Config</HeaderButton>
  </SegmentedButton>
);

const mapStateToProps = (state: State) => ({
  executionLabel: getExecutionLabel(state),
  modeLabel: getModeLabel(state),
  channelLabel: getChannelLabel(state),
  navigateToHelp,
  advancedOptionsSet: getAdvancedOptionsSet(state),
});

const mapDispatchToProps = ({
  execute: performExecute,
  gistSave: performGistSave,
});

export default connect(mapStateToProps, mapDispatchToProps)(Header);
