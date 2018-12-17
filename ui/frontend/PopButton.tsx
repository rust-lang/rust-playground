import React from 'react';
import { Arrow, Manager, Popper, Target } from 'react-popper';
import { Portal } from 'react-portal';

export type SetRefFunc = (ref: HTMLElement) => void;
export type ButtonFactory = (_: PopButtonEnhancements) => React.ReactNode;
export type ContentFactory = (_: PopButtonContentEnhancements) => React.ReactNode;

export interface PopButtonEnhancements {
  popButtonProps: {
    ref: SetRefFunc;
    onClick: () => void;
  };
}

interface PopButtonStatelessProps {
  button: ButtonFactory;
  isOpen: boolean;
  onClick: () => void;
  setButtonRef: SetRefFunc;
  setPopperRef: SetRefFunc;
}

const PopButtonStateless: React.SFC<PopButtonStatelessProps> =
  ({ button, children, isOpen, onClick, setButtonRef, setPopperRef }) => {

    const targetTrampoline = ({ targetProps: { ref: setTargetRef, ...targetProps } }) => (
      button({
        popButtonProps: {
          onClick,
          ref: r => {
            setButtonRef(r);
            setTargetRef(r);
          },
        },
      })
    );

    return (
      <Manager tag={false}>
        <Target>{targetTrampoline}</Target>
        {isOpen && <PopButtonPopper setPopperRef={setPopperRef}>{children}</PopButtonPopper>}
      </Manager>
    );
  };

interface PopButtonPopperProps {
  setPopperRef: SetRefFunc;
}

const PopButtonPopper: React.SFC<PopButtonPopperProps> = ({ setPopperRef, children }) => (
  <Portal>
    <div ref={setPopperRef}>
      <Popper className="popper" placement="bottom" modifiers={{ computeStyle: { gpuAcceleration: false } }}>
        <Arrow className="popper__arrow" />
        <div className="popper__content">{children}</div>
      </Popper>
    </div>
  </Portal>
);

interface PopButtonProps {
  button: ButtonFactory;
  children: React.ReactNode | ContentFactory;
}

interface PopButtonState {
  isOpen: boolean;
}

export interface PopButtonContentEnhancements {
  popButtonClose: () => void;
}

class PopButton extends React.Component<PopButtonProps, PopButtonState> {
  private buttonRef;
  private popperRef;

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

  private setButtonRef = r => {
    this.buttonRef = r;
  }

  private setPopperRef = r => {
    this.popperRef = r;
  }

  private handleClickOutside = event => {
    if (this.buttonRef && this.buttonRef.contains(event.target)) {
      // They are clicking on the button, so let that go ahead and close us.
      return;
    }

    if (this.popperRef && !this.popperRef.contains(event.target)) {
      this.close();
    }
  }

  public componentDidMount() {
    document.addEventListener('mousedown', this.handleClickOutside);
  }

  public componentWillUnmount() {
    document.removeEventListener('mousedown', this.handleClickOutside);
  }

  public render() {
    const { isOpen } = this.state;
    const { button, children } = this.props;

    const enhancedProps = { popButtonClose: this.close };
    const enhancedChildren =
      children instanceof Function ?
        children(enhancedProps) :
        children;

    return (
      <PopButtonStateless
        button={button}
        isOpen={isOpen}
        onClick={this.handleToggleVisibility}
        setButtonRef={this.setButtonRef}
        setPopperRef={this.setPopperRef}>
        {enhancedChildren}
      </PopButtonStateless>
    );
  }
}

export default PopButton;
