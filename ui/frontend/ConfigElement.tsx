import React from 'react';

import MenuItem from './MenuItem';

interface EitherProps extends ConfigElementProps {
  id: string;
  a: string;
  b: string;
  aLabel?: string;
  bLabel?: string;
  value: string;
  onChange: (_: string) => any;
}

export const Either: React.SFC<EitherProps> =
  ({ id, a, b, aLabel = a, bLabel = b, value, onChange, ...rest }) => (
    <ConfigElement {...rest}>
      <div className="config-element__toggle">
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

export const Select: React.SFC<SelectProps> = ({ value, onChange, children, ...rest }) => (
  <ConfigElement {...rest}>
    <select className="config-element__select" value={value} onChange={e => onChange(e.target.value)}>
      {children}
    </select>
  </ConfigElement>
);

interface ConfigElementProps {
  name: string;
  isNotDefault?: boolean;
}

const ConfigElement: React.SFC<ConfigElementProps> = ({ name, isNotDefault, children }) => (
  <MenuItem>
    <div className="config-element">
      <span className={`config-element__name ${isNotDefault ? 'config-element__name--not-default' : ''}`}>{name}</span>
      <div className="config-element__value">
        {children}
      </div>
    </div>
  </MenuItem>
);
