import React, { useCallback } from 'react';
import { Portal } from 'react-portal';
import { useDispatch, useSelector } from 'react-redux';

import { Close } from './Icon';

import * as actions from './actions';
import * as selectors from './selectors';

import styles from './Notifications.module.css';

const EDITION_URL = 'https://doc.rust-lang.org/edition-guide/';
const SURVEY_URL = 'https://blog.rust-lang.org/2021/12/08/survey-launch.html';

const Notifications: React.SFC = () => {
  return (
    <Portal>
      <div className={styles.container}>
        <Rust2021IsDefaultNotification />
        <RustSurvey2021Notification />
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


const RustSurvey2021Notification: React.SFC = () => {
  const showRustSurvey2021 = useSelector(selectors.showRustSurvey2021Selector);

  const dispatch = useDispatch();
  const seenRustSurvey2021 = useCallback(() => dispatch(actions.seenRustSurvey2021()), [dispatch]);

  return showRustSurvey2021 && (
    <Notification onClose={seenRustSurvey2021}>
      Please help us take a look at who the Rust community is
      composed of, how the Rust project is doing, and how we can
      improve the Rust programming experience by completing the <a
        href={SURVEY_URL}>2021 State of Rust Survey</a>. Whether or
      not you use Rust today, we want to know your opinions.
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
