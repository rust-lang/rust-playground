import React from 'react';

import MenuItem from './MenuItem';

import styles from './ConfigElement.module.css';

interface EitherProps extends ConfigElementProps {
  id: string;
  a: string;
  b: string;
  aLabel?: string;
  bLabel?: string;
  value: string;
  onChange: (_: string) => any;
}

export const Either: React.FC<EitherProps> =
  ({ id, a, b, aLabel = a, bLabel = b, value, onChange, ...rest }) => (
    <ConfigElement {...rest}>
      <div className={styles.toggle}>
        <input id={`${id}-a`}
          name={id}
          value={a}
          type="radio"
          checked={value === a}
          onChange={() => onChange(a)} />
        <label htmlFor={`${id}-a`}>{aLabel}</label>
        <input id={`${id}-b`}
          name={id}
          value={b}
          type="radio"
          checked={value === b}
          onChange={() => onChange(b)} />
        <label htmlFor={`${id}-b`}>{bLabel}</label>
      </div>
    </ConfigElement>
  );

interface SelectProps extends ConfigElementProps {
  value: string;
  onChange: (_: string) => any;
}

export const Select: React.FC<SelectProps> = ({ value, onChange, children, ...rest }) => (
  <ConfigElement {...rest}>
    <select className={styles.select} value={value} onChange={e => onChange(e.target.value)}>
      {children}
    </select>
  </ConfigElement>
);

interface ConfigElementProps {
  name: string;
  isNotDefault?: boolean;
  aside?: JSX.Element,
}

const ConfigElement: React.FC<ConfigElementProps> = ({ name, isNotDefault, aside, children }) => (
  <MenuItem>
    <div className={styles.container}>
      <span className={isNotDefault ? styles.notDefault : styles.name}>{name}</span>
      <div className={styles.value}>
        {children}
      </div>
    </div>
    {aside}
  </MenuItem>
);
