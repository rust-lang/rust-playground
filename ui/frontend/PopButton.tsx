import React from 'react';
import { Arrow, Manager, Popper, Target } from 'react-popper';

interface PopButtonStatelessProps {
  text: string;
  isOpen: boolean;
  onClick: () => any;
}

const PopButtonStateless: React.SFC<PopButtonStatelessProps> =
  ({ text, children, isOpen, onClick }) => (
    <Manager tag={false}>
      <Target>{({ targetProps }) => (
        <button onClick={onClick} {...targetProps}>{text}</button>
      )}</Target>
      {isOpen && <PopButtonPopper>{children}</PopButtonPopper>}
    </Manager>
  );

const PopButtonPopper = ({ children }) => (
  <Popper className="popper" placement="bottom">
    <Arrow className="popper__arrow" />
    <div className="popper__content">{children}</div>
  </Popper>
);

interface PopButtonProps {
  text: string;
  children: React.ReactNode | ((_: PopButtonEnhancements) => React.ReactNode);
}

interface PopButtonState {
  isOpen: boolean;
}

export interface PopButtonEnhancements {
  popButtonClose: () => void;
}

class PopButton extends React.Component<PopButtonProps, PopButtonState> {
  constructor(props) {
    super(props);
    this.state = {
      isOpen: false,
    };
  }

  private handleToggleVisibility = () => {
    this.setState({ isOpen: !this.state.isOpen });
  }

  private close = () => {
    this.setState({ isOpen: false });
  }

  public render() {
    const { isOpen } = this.state;
    const { text, children } = this.props;

    const enhancedProps = { popButtonClose: this.close };
    const enhancedChildren =
      typeof children === 'function' ?
        children(enhancedProps) :
        children;

    return (
      <PopButtonStateless
        text={text}
        isOpen={isOpen}
        onClick={this.handleToggleVisibility}>
        {enhancedChildren}
      </PopButtonStateless>
    );
  }
}

export default PopButton;
