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
}

interface PopButtonState {
  isOpen: boolean;
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

  public render() {
    const { isOpen } = this.state;
    const { text, children } = this.props;
    return (
      <PopButtonStateless
        text={text}
        isOpen={isOpen}
        onClick={this.handleToggleVisibility}>
        {children}
      </PopButtonStateless>
    );
  }
}

export default PopButton;
