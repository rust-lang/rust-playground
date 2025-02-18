import React, { useCallback } from 'react';
import { Portal } from 'react-portal';

import { Close } from './Icon';
import { useAppDispatch, useAppSelector } from './hooks';
import { seenRust2024IsDefault } from './reducers/notifications';
import { allowLongRun, wsExecuteKillCurrent } from './reducers/output/execute';
import * as selectors from './selectors';

import * as styles from './Notifications.module.css';

const EDITION_URL = 'https://doc.rust-lang.org/edition-guide/';

const Notifications: React.FC = () => {
  return (
    <Portal>
      <div className={styles.container}>
        <Rust2024IsDefaultNotification />
        <ExcessiveExecutionNotification />
      </div>
    </Portal>
  );
};

const Rust2024IsDefaultNotification: React.FC = () => {
  const showIt = useAppSelector(selectors.showRust2024IsDefaultSelector);

  const dispatch = useAppDispatch();
  const seenIt = useCallback(() => dispatch(seenRust2024IsDefault()), [dispatch]);

  return showIt ? (
    <Notification onClose={seenIt}>
      As of Rust 1.85, the default edition of Rust is now Rust 2024. Learn more about editions in
      the <a href={EDITION_URL}>Edition Guide</a>. To specify which edition to use, use the advanced
      compilation options menu.
    </Notification>
  ) : null;
};

const ExcessiveExecutionNotification: React.FC = () => {
  const showExcessiveExecution = useAppSelector(selectors.excessiveExecutionSelector);
  const time = useAppSelector(selectors.excessiveExecutionTimeSelector);
  const gracePeriod = useAppSelector(selectors.killGracePeriodTimeSelector);

  const dispatch = useAppDispatch();
  const allow = useCallback(() => dispatch(allowLongRun()), [dispatch]);
  const kill = useCallback(() => dispatch(wsExecuteKillCurrent()), [dispatch]);

  return showExcessiveExecution ? (
    <Notification onClose={allow}>
      The running process has used more than {time} of CPU time. This is often caused by an error in
      the code. As the playground is a shared resource, the process will be automatically killed in{' '}
      {gracePeriod}. You can always kill the process manually via the menu at the bottom of the
      screen.
      <div className={styles.action}>
        <button onClick={kill}>Kill the process now</button>
        <button onClick={allow}>Allow the process to continue</button>
      </div>
    </Notification>
  ) : null;
};

interface NotificationProps {
  children: React.ReactNode;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ onClose, children }) => (
  <div className={styles.notification} data-test-id="notification">
    <div className={styles.notificationContent}>{children}</div>
    <button className={styles.close} onClick={onClose} title="dismiss notification">
      <Close />
    </button>
  </div>
);

export default Notifications;
