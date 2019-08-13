import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import AdvancedOptionsMenu from './AdvancedOptionsMenu';
import BuildMenu from './BuildMenu';
import ChannelMenu from './ChannelMenu';
import ConfigMenu from './ConfigMenu';
import HeaderButton from './HeaderButton';
import { BuildIcon, ConfigIcon, HelpIcon, MoreOptionsActiveIcon, MoreOptionsIcon } from './Icon';
import ModeMenu from './ModeMenu';
import PopButton, { PopButtonEnhancements } from './PopButton';
import { SegmentedButton, SegmentedButtonSet, SegmentedLink } from './SegmentedButton';
import ToolsMenu from './ToolsMenu';

import * as actions from './actions';
import * as selectors from './selectors';

const Header: React.SFC = () => {
  const advancedOptionsSet = useSelector(selectors.getAdvancedOptionsSet);
  const channelLabel = useSelector(selectors.getChannelLabel);
  const executionLabel = useSelector(selectors.getExecutionLabel);
  const modeLabel = useSelector(selectors.getModeLabel);

  const dispatch = useDispatch();
  const execute = useCallback(() => dispatch(actions.performPrimaryAction()), [dispatch]);
  const gistSave = useCallback(() => dispatch(actions.performGistSave()), [dispatch]);

  return (
    <div className="header">
      <HeaderSet id="build">
        <SegmentedButtonSet>
          <SegmentedButton isBuild onClick={execute}>
            <HeaderButton rightIcon={<BuildIcon />}>
              {executionLabel}
            </HeaderButton>
          </SegmentedButton>
          <PopButton button={BuildMenuButton}>{({ popButtonClose }) => (
            <BuildMenu close={popButtonClose} />
          )}</PopButton>
        </SegmentedButtonSet>
      </HeaderSet>
      <HeaderSet id="channel-mode">
        <SegmentedButtonSet>
          <PopButton
            button={p => <ModeMenuButton label={modeLabel} {...p} />}>{({ popButtonClose }) => (
              <ModeMenu close={popButtonClose} />
            )}</PopButton>
          <PopButton
            button={p => <ChannelMenuButton label={channelLabel}{...p} />}>{({ popButtonClose }) => (
              <ChannelMenu close={popButtonClose} />
            )}</PopButton>
          <PopButton
            button={({ ...p }) => <AdvancedOptionsMenuButton advancedOptionsSet={advancedOptionsSet} {...p} />}
          >
            <AdvancedOptionsMenu />
          </PopButton>
        </SegmentedButtonSet>
      </HeaderSet>
      <HeaderSet id="share">
        <SegmentedButtonSet>
          <SegmentedButton title="Create shareable links to this code" onClick={gistSave}>
            <HeaderButton>Share</HeaderButton>
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
          <SegmentedLink title="View help" action={actions.navigateToHelp}>
            <HeaderButton icon={<HelpIcon />} />
          </SegmentedLink>
        </SegmentedButtonSet>
      </HeaderSet>
    </div>
  );
};

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

export default Header;
