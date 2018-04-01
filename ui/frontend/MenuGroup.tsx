import React from 'react';

interface MenuGroupProps {
  title: string;
}

const MenuGroup: React.SFC<MenuGroupProps> = ({ title, children }) => (
  <div className="menu-group">
    <h1 className="menu-group__title">{title}</h1>
    <div className="menu-group__content">
      {children}
    </div>
  </div>
);

export default MenuGroup;
