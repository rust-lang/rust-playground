import React from 'react';
import { Portal } from 'react-portal';
import { connect } from 'react-redux';

import { Close } from './Icon';

import { seenRust2018IsDefault } from './actions';
import { showRust2018IsDefaultSelector } from './selectors';
import State from './state';

const EDITION_URL = 'https://doc.rust-lang.org/edition-guide/';

interface NotificationsProps {
  seenRust2018IsDefault: () => void;
  showRust2018IsDefault: boolean;
}

const Notifications: React.SFC<NotificationsProps> = props => (
  <Portal>
    <div className="notifications">
      {props.showRust2018IsDefault && <Rust2018IsDefaultNotification {...props} />}
    </div>
  </Portal>
);

const Rust2018IsDefaultNotification: React.SFC<NotificationsProps> = props => (
  <Notification onClose={props.seenRust2018IsDefault}>
    As of Rust 1.31, the default edition of Rust is now Rust
    2018. Learn more about editions in the <a href={EDITION_URL}>Edition Guide</a>.
    To specify which edition to use, use the advanced compilation options menu.
  </Notification>
);

interface NotificationProps {
  onClose: () => void;
}

const Notification: React.SFC<NotificationProps> = ({ onClose, children }) => (
  <div className="notifications__notification">
    <div className="notifications__notification-content">{children}</div>
    <button className="notifications__close" onClick={onClose}><Close /></button>
  </div>
);

const mapStateToProps = (state: State) => ({
  showRust2018IsDefault: showRust2018IsDefaultSelector(state),
});

const mapDispatchToProps = ({
  seenRust2018IsDefault,
});

export default connect(mapStateToProps, mapDispatchToProps)(Notifications);
