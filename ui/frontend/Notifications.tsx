import React from 'react';
import { Portal } from 'react-portal';
import { connect } from 'react-redux';

import { Close } from './Icon';

import { } from './actions';
import { } from './selectors';
import State from './state';

interface NotificationsProps {
}

const Notifications: React.SFC<NotificationsProps> = props => (
  <Portal>
    <div className="notifications">
    </div>
  </Portal>
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
});

const mapDispatchToProps = ({
});

export default connect(mapStateToProps, mapDispatchToProps)(Notifications);
