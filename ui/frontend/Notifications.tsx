import React, { useCallback } from 'react';
import { Portal } from 'react-portal';
import { useDispatch, useSelector } from 'react-redux';

import { Close } from './Icon';

import * as actions from './actions';
import * as selectors from './selectors';

const EDITION_URL = 'https://doc.rust-lang.org/edition-guide/';

const Notifications: React.SFC = () => {
  return (
    <Portal>
      <div className="notifications">
        <Rust2018IsDefaultNotification />
      </div>
    </Portal>
  );
};

const Rust2018IsDefaultNotification: React.SFC = () => {
  const showRust2018IsDefault = useSelector(selectors.showRust2018IsDefaultSelector);

  const dispatch = useDispatch();
  const seenRust2018IsDefault = useCallback(() => dispatch(actions.seenRust2018IsDefault()), [dispatch]);

  return showRust2018IsDefault && (
    <Notification onClose={seenRust2018IsDefault}>
      As of Rust 1.31, the default edition of Rust is now Rust
        2018. Learn more about editions in the <a href={EDITION_URL}>Edition Guide</a>.
  To specify which edition to use, use the advanced compilation options menu.
    </Notification>
  );
};

interface NotificationProps {
  onClose: () => void;
}

const Notification: React.SFC<NotificationProps> = ({ onClose, children }) => (
  <div className="notifications__notification">
    <div className="notifications__notification-content">{children}</div>
    <button className="notifications__close" onClick={onClose}><Close /></button>
  </div>
);

export default Notifications;
