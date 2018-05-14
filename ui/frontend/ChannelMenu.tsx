import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import MenuGroup from './MenuGroup';
import SelectOne from './SelectOne';

import { changeChannel } from './actions';
import {
  betaVersionDetailsText,
  betaVersionText,
  nightlyVersionDetailsText,
  nightlyVersionText,
  stableVersionText,
} from './selectors';
import State from './state';
import { Channel } from './types';

interface ChannelMenuProps {
  channel: Channel;
  changeChannel: (_: Channel) => any;
  stableVersion: string;
  betaVersion: string;
  nightlyVersion: string;
  betaVersionDetails: string;
  nightlyVersionDetails: string;
  close: () => void;
}

const ChannelMenu: React.SFC<ChannelMenuProps> = props => (
  <Fragment>
    <MenuGroup title="Channel &mdash; Choose the rust version">
      <SelectOne
        name="Stable channel"
        currentValue={props.channel}
        thisValue={Channel.Stable}
        changeValue={channel => { props.changeChannel(channel); props.close(); }}
      >
        <Desc>Build using the Stable version: {props.stableVersion}</Desc>
      </SelectOne>
      <SelectOne
        name="Beta channel"
        currentValue={props.channel}
        thisValue={Channel.Beta}
        changeValue={channel => { props.changeChannel(channel); props.close(); }}
      >
        <Desc>Build using the Beta version: {props.betaVersion}</Desc>
        <Desc>({props.betaVersionDetails})</Desc>
      </SelectOne>
      <SelectOne
        name="Nightly channel"
        currentValue={props.channel}
        thisValue={Channel.Nightly}
        changeValue={channel => { props.changeChannel(channel); props.close(); }}
      >
        <Desc>Build using the Nightly version: {props.nightlyVersion}</Desc>
        <Desc>({props.nightlyVersionDetails})</Desc>
      </SelectOne>
    </MenuGroup>
  </Fragment>
);

const Desc: React.SFC<{}> = ({ children }) => (
  <p className="channel-menu__description">{children}</p>
);

const mapStateToProps = (state: State) => {
  const { configuration: { channel } } = state;

  return {
    channel,
    stableVersion: stableVersionText(state),
    betaVersion: betaVersionText(state),
    nightlyVersion: nightlyVersionText(state),
    betaVersionDetails: betaVersionDetailsText(state),
    nightlyVersionDetails: nightlyVersionDetailsText(state),
  };
};

const mapDispatchToProps = {
  changeChannel,
};

export default connect(mapStateToProps, mapDispatchToProps)(ChannelMenu);
