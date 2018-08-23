import React from 'react';
import { Portal } from 'react-portal';
import { connect } from 'react-redux';

import { Close } from './Icon';

import { seenRustSurvey2018 } from './actions';
import { showRustSurvey2018Selector } from './selectors';
import State from './state';

const SURVEY_URL = 'https://goo.gl/forms/jFydE7csObcl6vxr1';

interface NotificationsProps {
  seenRustSurvey2018: () => void;
  showRustSurvey2018: boolean;
}

const Notifications: React.SFC<NotificationsProps> = props => (
  <Portal>
    <div className="notifications">
      {props.showRustSurvey2018 && <RustSurvey2018Notification {...props} />}
    </div>
  </Portal>
);

const RustSurvey2018Notification: React.SFC<NotificationsProps> = props => (
  <Notification onClose={props.seenRustSurvey2018}>
    We want to know your opinions! Your responses to
    the <a href={SURVEY_URL}>2018 State of Rust Survey</a> will
    help the project understand its strengths and weaknesses and
    establish development priorities for the future!
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
  showRustSurvey2018: showRustSurvey2018Selector(state),
});

const mapDispatchToProps = ({
  seenRustSurvey2018,
});

export default connect(mapStateToProps, mapDispatchToProps)(Notifications);
