import React, { useCallback } from 'react';
import { Portal } from 'react-portal';
import { useDispatch, useSelector } from 'react-redux';

import { Close } from './Icon';

import * as actions from './actions';
import * as selectors from './selectors';

import styles from './Notifications.module.css';

const EDITION_URL = 'https://doc.rust-lang.org/edition-guide/';

const Notifications: React.SFC = () => {
  return (
    <Portal>
      <div className={styles.container}>
        <Rust2021IsDefaultNotification />
      </div>
    </Portal>
  );
};

const Rust2021IsDefaultNotification: React.SFC = () => {
  const showRust2021IsDefault = useSelector(selectors.showRust2021IsDefaultSelector);

  const dispatch = useDispatch();
  const seenRust2021IsDefault = useCallback(() => dispatch(actions.seenRust2021IsDefault()), [dispatch]);

  return showRust2021IsDefault && (
    <Notification onClose={seenRust2021IsDefault}>
      As of Rust 1.56, the default edition of Rust is now Rust
      2021. Learn more about editions in the <a href={EDITION_URL}>Edition Guide</a>.
      To specify which edition to use, use the advanced compilation options menu.
    </Notification>
  );
};

interface NotificationProps {
  onClose: () => void;
}

const Notification: React.SFC<NotificationProps> = ({ onClose, children }) => (
  <div className={styles.notification}>
    <div className={styles.notificationContent}>{children}</div>
    <button className={styles.close} onClick={onClose}><Close /></button>
  </div>
);

export default Notifications;
