import React, { useCallback } from 'react';
import { Portal } from 'react-portal';

import { Close } from './Icon';
import { useAppDispatch, useAppSelector } from './hooks';
import { swapTheme } from './reducers/configuration';
import { seenDarkMode, seenRustSurvey2023 } from './reducers/notifications';
import { allowLongRun, wsExecuteKillCurrent } from './reducers/output/execute';
import * as selectors from './selectors';
import { Theme } from './types';

import * as styles from './Notifications.module.css';

const SURVEY_URL = 'https://blog.rust-lang.org/2023/12/18/survey-launch.html';

const Notifications: React.FC = () => {
  return (
    <Portal>
      <div className={styles.container}>
        <DarkModeNotification />
        <RustSurvey2023Notification />
        <ExcessiveExecutionNotification />
      </div>
    </Portal>
  );
};

const DarkModeNotification: React.FC = () => {
  const showIt = useAppSelector(selectors.showDarkModeSelector);

  const dispatch = useAppDispatch();
  const seenIt = useCallback(() => dispatch(seenDarkMode()), [dispatch]);
  const swapToLight = useCallback(() => dispatch(swapTheme(Theme.Light)), [dispatch]);
  const swapToDark = useCallback(() => dispatch(swapTheme(Theme.Dark)), [dispatch]);
  const swapToSystem = useCallback(() => dispatch(swapTheme(Theme.System)), [dispatch]);

  return showIt ? (
    <Notification onClose={seenIt}>
      <p>The playground now has a dark mode! Sample the themes here:</p>

      <table>
        <tr>
          <th>
            <button className={styles.swapTheme} onClick={swapToSystem}>
              System
            </button>
          </th>
          <td>Use your system&apos;s preference</td>
        </tr>

        <tr>
          <th>
            <button className={styles.swapTheme} onClick={swapToLight}>
              Light
            </button>
          </th>
          <td>The classic playground style</td>
        </tr>

        <tr>
          <th>
            <button className={styles.swapTheme} onClick={swapToDark}>
              Dark
            </button>
          </th>
          <td>Reduce the number of photons hitting your eyeballs</td>
        </tr>
      </table>

      <p>
        You can change the current UI theme (and the editor&apos;s theme) in the configuration menu.
      </p>
    </Notification>
  ) : null;
};

const RustSurvey2023Notification: React.FC = () => {
  const showIt = useAppSelector(selectors.showRustSurvey2023Selector);

  const dispatch = useAppDispatch();
  const seenIt = useCallback(() => dispatch(seenRustSurvey2023()), [dispatch]);

  return showIt ? (
    <Notification onClose={seenIt}>
      Please help us take a look at who the Rust community is composed of, how the Rust project is
      doing, and how we can improve the Rust programming experience by completing the{' '}
      <a href={SURVEY_URL}>2023 State of Rust Survey</a>. Whether or not you use Rust today, we want
      to know your opinions.
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
