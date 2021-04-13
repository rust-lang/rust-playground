import React, { useCallback } from 'react';
import { Portal } from 'react-portal';
import { useDispatch, useSelector } from 'react-redux';

import { Close } from './Icon';

import * as actions from './actions';
import * as selectors from './selectors';

import styles from './Notifications.module.css';

const SURVEY_URL = 'https://blog.rust-lang.org/2020/09/10/survey-launch.html';

const Notifications: React.SFC = () => {
  return (
    <Portal>
      <div className={styles.container}>
        <Rust2020SurveyNotification />
      </div>
    </Portal>
  );
};

const Rust2020SurveyNotification: React.SFC = () => {
  const showRust2020Survey = useSelector(selectors.showRustSurvey2020Selector);

  const dispatch = useDispatch();
  const seenRustSurvey2020 = useCallback(() => dispatch(actions.seenRustSurvey2020()), [dispatch]);

  return showRust2020Survey && (
    <Notification onClose={seenRustSurvey2020}>
      We want to know your opinions! Your responses to
      the <a href={SURVEY_URL}>2020 State of Rust Survey</a> will
      help the project understand its strengths and weaknesses
      and establish development priorities for the future!
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
