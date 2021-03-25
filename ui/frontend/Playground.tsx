import React from 'react';
import { useSelector } from 'react-redux';

import Editor from './Editor';
import Header from './Header';
import Notifications from './Notifications';
import Output from './Output';
import * as selectors from './selectors';
import State from './state';
import { Orientation } from './types';

import styles from './Playground.module.css';

const ORIENTATION_STYLE_MAP = {
  [Orientation.Automatic]: styles.splitAutomatic,
  [Orientation.Horizontal]: styles.splitHorizontal,
  [Orientation.Vertical]: styles.splitVertical,
}

const Playground: React.SFC = () => {
  const showNotifications = useSelector(selectors.anyNotificationsToShowSelector);
  const focus = useSelector((state: State) => state.output.meta.focus);
  const splitOrientation = useSelector((state: State) => state.configuration.orientation);

  const outputFocused = focus ? styles.outputFocused : '';
  const splitClass = ORIENTATION_STYLE_MAP[splitOrientation];

  return (
    <div>
      <div className={styles.container}>
        <div>
          <Header />
        </div>
        <div className={splitClass}>
          <div className={styles.editor}>
            <Editor />
          </div>
          <div className={outputFocused}>
            <Output isFocused={!!focus} />
          </div>
        </div>
      </div>
      { showNotifications && <Notifications />}
    </div>
  );
};

export default Playground;
