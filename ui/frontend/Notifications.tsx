import React, { useEffect, useRef } from 'react';

import { Close } from './Icon';
import { preserveContentAndChangeFileView } from './actions';
import { useAppDispatch, useAppSelector } from './hooks';
import * as client from './reducers/client';
import { acknowledgeAutomaticFileView } from './reducers/configuration';
import { seenMultipleFiles } from './reducers/notifications';
import { allowLongRun, wsExecuteKillCurrent } from './reducers/output/execute';
import * as selectors from './selectors';
import { FileView } from './types';

import * as styles from './Notifications.module.css';

const Notifications: React.FC = () => {
  const showNotifications = useAppSelector(selectors.anyNotificationsToShowSelector);

  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (showNotifications) {
      dialog.current?.show();
    } else {
      dialog.current?.close();
    }
  }, [showNotifications]);

  return (
    <dialog ref={dialog} className={styles.container}>
      <MultiFileNotification />
      <ExcessiveExecutionNotification />
      <ResetConfigurationNotification />
      <ResetOldConfigurationNotification />
      <FileModeChangedByUrlNotification />
    </dialog>
  );
};

const MultiFileNotification: React.FC = () => {
  'use memo';

  const showIt = useAppSelector(selectors.showMultipleFilesSelector);

  const dispatch = useAppDispatch();
  const seenIt = () => dispatch(seenMultipleFiles());
  const single = () => {
    dispatch(preserveContentAndChangeFileView(FileView.Single));
    dispatch(seenMultipleFiles());
  };
  const multiple = () => {
    dispatch(preserveContentAndChangeFileView(FileView.Multiple));
    dispatch(seenMultipleFiles());
  };

  return showIt ? (
    <Notification onClose={seenIt}>
      The Playground now allows editing multiple files! Turn this feature on and off in the
      configuration menu.
      <div className={styles.action}>
        <button onClick={single}>Stay in single file mode</button>
        <button onClick={multiple}>Change to multiple file mode</button>
      </div>
    </Notification>
  ) : null;
};

const FileModeChangedByUrlNotification: React.FC = () => {
  'use memo';

  const previous = useAppSelector((s) => s.configuration.fileViewAutomaticallyChangedFrom);
  const current = useAppSelector((s) => s.configuration.fileView);

  const dispatch = useAppDispatch();
  const seenIt = () => dispatch(acknowledgeAutomaticFileView());
  const single = () => {
    dispatch(preserveContentAndChangeFileView(FileView.Single));
    dispatch(acknowledgeAutomaticFileView());
  };
  const multiple = () => {
    dispatch(preserveContentAndChangeFileView(FileView.Multiple));
    dispatch(acknowledgeAutomaticFileView());
  };

  if (!previous) return;

  const name = (fv: FileView) =>
    fv === FileView.Single ? 'single file mode' : 'multiple file mode';
  const s = (fv: FileView) => (current === fv ? `Stay in ${name(fv)}` : `Change to ${name(fv)}`);

  return (
    <Notification onClose={seenIt}>
      The link you opened was created in {name(current)}, but the editor was in {name(previous)}.
      The mode has been changed to match, but you can always switch back in the configuration menu.
      <div className={styles.action}>
        <button onClick={single}>{s(FileView.Single)}</button>
        <button onClick={multiple}>{s(FileView.Multiple)}</button>
      </div>
    </Notification>
  );
};

const ExcessiveExecutionNotification: React.FC = () => {
  'use memo';

  const showExcessiveExecution = useAppSelector(selectors.excessiveExecutionSelector);
  const time = useAppSelector(selectors.excessiveExecutionTimeSelector);
  const gracePeriod = useAppSelector(selectors.killGracePeriodTimeSelector);

  const dispatch = useAppDispatch();
  const allow = () => dispatch(allowLongRun());
  const kill = () => dispatch(wsExecuteKillCurrent());

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

interface ResetNotificationCommonProps {
  preamble?: string;
  onReset: () => void;
  onCancel: () => void;
}

const ResetNotificationCommon: React.FC<ResetNotificationCommonProps> = ({
  preamble,
  onReset,
  onCancel,
}) => (
  <Notification onClose={onCancel}>
    {preamble}
    Would you like to reset all code and configuration back to the default values to get a fresh
    start?
    <div className={styles.action}>
      <button onClick={onReset}>Reset all code and configuration</button>
      <button onClick={onCancel}>Keep the current code and configuration</button>
    </div>
  </Notification>
);

const ResetConfigurationNotification: React.FC = () => {
  'use memo';

  const showResetConfiguration = useAppSelector(selectors.resetConfigurationSelector);

  const dispatch = useAppDispatch();
  const reset = () => dispatch(client.resetEverything());
  const keep = () => dispatch(client.hideConfigReset());

  return showResetConfiguration ? (
    <ResetNotificationCommon onReset={reset} onCancel={keep} />
  ) : null;
};

const ResetOldConfigurationNotification: React.FC = () => {
  'use memo';

  const showResetOldConfiguration = useAppSelector(selectors.resetOldConfigurationSelector);

  const dispatch = useAppDispatch();
  const reset = () => dispatch(client.resetEverything());
  const keep = () => dispatch(client.updateLastVisitedAt());

  const preamble = "It's been a while since you've used the Playground. ";

  return showResetOldConfiguration ? (
    <ResetNotificationCommon preamble={preamble} onReset={reset} onCancel={keep} />
  ) : null;
};

interface NotificationProps {
  children: React.ReactNode;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ onClose, children }) => (
  <div className={styles.notification} data-test-id="notification">
    <button className={styles.close} onClick={onClose} title="dismiss notification">
      <Close />
    </button>
    <div className={styles.notificationContent}>{children}</div>
  </div>
);

export default Notifications;
