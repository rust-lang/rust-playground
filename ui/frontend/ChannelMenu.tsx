import React, { Fragment, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import MenuGroup from './MenuGroup';
import SelectOne from './SelectOne';

import * as actions from './actions';
import * as selectors from './selectors';
import State from './state';
import { Channel } from './types';

import styles from './ChannelMenu.module.css';

interface ChannelMenuProps {
  close: () => void;
}

const ChannelMenu: React.FC<ChannelMenuProps> = props => {
  const channel = useSelector((state: State) => state.configuration.channel);
  const stableVersion = useSelector(selectors.stableVersionText);
  const betaVersion = useSelector(selectors.betaVersionText);
  const nightlyVersion = useSelector(selectors.nightlyVersionText);
  const betaVersionDetails = useSelector(selectors.betaVersionDetailsText);
  const nightlyVersionDetails = useSelector(selectors.nightlyVersionDetailsText);

  const dispatch = useDispatch();
  const changeChannel = useCallback((channel: Channel) => {
    dispatch(actions.changeChannel(channel));
    props.close();
  }, [dispatch, props]);

  return (
    <Fragment>
      <MenuGroup title="Channel &mdash; Choose the rust version">
        <SelectOne
          name="Stable channel"
          currentValue={channel}
          thisValue={Channel.Stable}
          changeValue={changeChannel}
        >
          <Desc>Build using the Stable version: {stableVersion}</Desc>
        </SelectOne>
        <SelectOne
          name="Beta channel"
          currentValue={channel}
          thisValue={Channel.Beta}
          changeValue={changeChannel}
        >
          <Desc>Build using the Beta version: {betaVersion}</Desc>
          <Desc>({betaVersionDetails})</Desc>
        </SelectOne>
        <SelectOne
          name="Nightly channel"
          currentValue={channel}
          thisValue={Channel.Nightly}
          changeValue={changeChannel}
        >
          <Desc>Build using the Nightly version: {nightlyVersion}</Desc>
          <Desc>({nightlyVersionDetails})</Desc>
        </SelectOne>
      </MenuGroup>
    </Fragment>
  );
};

const Desc: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => (
  <p className={styles.description}>{children}</p>
);

export default ChannelMenu;
