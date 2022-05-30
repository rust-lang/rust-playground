import React, { useCallback } from 'react';
import { Portal } from 'react-portal';
import { useDispatch, useSelector } from 'react-redux';

import { Close } from './Icon';

import * as actions from './actions';
import * as selectors from './selectors';

import styles from './Notifications.module.css';

const MONACO_EDITOR_URL = 'https://microsoft.github.io/monaco-editor/';

const Notifications: React.FC = () => {
  return (
    <Portal>
      <div className={styles.container}>
        <MonacoEditorAvailableNotification />
      </div>
    </Portal>
  );
};

const MonacoEditorAvailableNotification: React.FC = () => {
  const monacoEditorAvailable = useSelector(selectors.showMonacoEditorAvailableSelector);

  const dispatch = useDispatch();
  const seenMonacoEditorAvailable = useCallback(() => dispatch(actions.seenMonacoEditorAvailable()), [dispatch]);

  return monacoEditorAvailable ? (
    <Notification onClose={seenMonacoEditorAvailable}>
      The <a href={MONACO_EDITOR_URL}>Monaco Editor</a>, the code editor
      that powers VS Code, is now available in the playground. Choose
      your preferred editor from the Config menu.
    </Notification>
  ) : null;
};

interface NotificationProps {
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ onClose, children }) => (
  <div className={styles.notification}>
    <div className={styles.notificationContent}>{children}</div>
    <button className={styles.close} onClick={onClose}><Close /></button>
  </div>
);

export default Notifications;
