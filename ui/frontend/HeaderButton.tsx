import React from 'react';

import { ExpandableIcon } from './Icon';

interface HeaderButtonProps {
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isExpandable?: boolean;
}

const HeaderButton: React.SFC<HeaderButtonProps> = ({ icon, rightIcon, isExpandable, children }) => {
  const c = ['header-button'];

  if (icon) { c.push('header-button--has-left-icon'); }
  if (rightIcon) { c.push('header-button--has-right-icon'); }
  if (isExpandable) { c.push('header-button--expandable'); }
  if ((icon || rightIcon) && !isExpandable && !children) { c.push('header-button--icon-only'); }

  return (
    <div className={c.join(' ')}>
      {icon && <div className="header-button__left-icon">{icon}</div>}
      {children}
      {rightIcon && <div className="header-button__right-icon">{rightIcon}</div>}
      {isExpandable && <div className="header-button__drop"><ExpandableIcon /></div>}
    </div>
  );
};

export default HeaderButton;
