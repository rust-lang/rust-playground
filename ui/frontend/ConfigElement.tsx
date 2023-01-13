import React from 'react';

import MenuItem from './MenuItem';

import styles from './ConfigElement.module.css';

interface EitherProps<T extends string> extends ConfigElementProps {
  id: string;
  a: string;
  b: string;
  aLabel?: string;
  bLabel?: string;
  value: T;
  onChange: (_: T) => any;
}

export const Either =
  <T extends string,>({ id, a, b, aLabel = a, bLabel = b, value, onChange, ...rest }: EitherProps<T>) => (
    <ConfigElement {...rest}>
      <div className={styles.toggle}>
        <input id={`${id}-a`}
          name={id}
          value={a}
          type="radio"
          checked={value === a}
          onChange={() => onChange(a as T)} />
        <label htmlFor={`${id}-a`}>{aLabel}</label>
        <input id={`${id}-b`}
          name={id}
          value={b}
          type="radio"
          checked={value === b}
          onChange={() => onChange(b as T)} />
        <label htmlFor={`${id}-b`}>{bLabel}</label>
      </div>
    </ConfigElement>
  );

interface SelectProps<T extends string> extends ConfigElementProps {
  children: React.ReactNode;
  value: T;
  onChange: (_: T) => any;
}

export const Select = <T extends string,>({ value, onChange, children, ...rest }: SelectProps<T>) => (
  <ConfigElement {...rest}>
    <select className={styles.select} value={value} onChange={e => onChange(e.target.value as T)}>
      {children}
    </select>
  </ConfigElement>
);

interface ConfigElementProps {
  children?: React.ReactNode;
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
