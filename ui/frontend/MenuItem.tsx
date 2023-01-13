import React from 'react';

import styles from './MenuItem.module.css';

const MenuItem: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => (
  <div className={styles.container}>{children}</div>
);

export default MenuItem;
