import React from 'react';

import { ExpandableIcon } from './Icon';

interface RightIconProps {
  icon: React.ReactNode;
}

export const RightIcon: React.SFC<HeaderButtonProps> = ({ icon, children }) => (
  <div className="header-button header-button--has-right-icon">
    {children}
    <div className="header-button__right-icon">{icon}</div>
  </div>
);

interface HeaderButtonProps {
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isExpandable?: boolean;
}

const HeaderButton: React.SFC<HeaderButtonProps> = ({ icon, isExpandable, children }) => {
  const c = ['header-button'];

  if (isExpandable) { c.push('header-button--expandable'); }
  if (icon) { c.push('header-button--has-left-icon'); }
  if (icon && !isExpandable && !children) { c.push('header-button--icon-only'); }

  return (
    <div className={c.join(' ')}>
      {icon && <div className="header-button__left-icon">{icon}</div>}
      {children}
      {isExpandable && <div className="header-button__drop"><ExpandableIcon /></div>}
    </div>
  );
};

export default HeaderButton;
