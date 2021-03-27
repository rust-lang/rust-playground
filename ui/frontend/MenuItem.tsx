import React from 'react';

import styles from './MenuItem.module.css';

const MenuItem: React.SFC<{}> = ({ children }) => (
  <div className={styles.container}>{children}</div>
);

export default MenuItem;
