import React, { Fragment } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { useSelector } from 'react-redux';

import { ClipboardIcon } from '../Icon';
import { State } from '../reducers';
import * as selectors from '../selectors';

import Loader from './Loader';
import Section from './Section';

import styles from './Gist.module.css';

const Gist: React.FC = () => {
  const showLoader = useSelector(selectors.showGistLoaderSelector);

  return (
    <div>
      { showLoader ? <Loader /> : <Links />}
    </div>
  );
};

interface CopiedProps {
  children: React.ReactNode;
  href: string;
}

interface CopiedState {
  copied: boolean;
}

class Copied extends React.PureComponent<CopiedProps, CopiedState> {
  public constructor(props: CopiedProps) {
    super(props);
    this.state = { copied: false };
  }

  public render() {
    return (
      <p className={this.state.copied ? styles.active : styles.container}>
        <a href={this.props.href}>{this.props.children}</a>
        <CopyToClipboard text={this.props.href} onCopy={this.copied}>
          <button className={styles.button}><ClipboardIcon /></button>
        </CopyToClipboard>
        <span className={styles.text}>Copied!</span>
      </p>
    );
  }

  private copied = () => {
    this.setState({ copied: true });
    setTimeout(() => { this.setState({ copied: false }); }, 1000);
  }
}

const Links: React.FC = () => {
  const codeUrl = useSelector(selectors.codeUrlSelector);
  const gistUrl = useSelector((state: State) => state.output.gist.url);
  const permalink = useSelector(selectors.permalinkSelector);
  const urloUrl = useSelector(selectors.urloUrlSelector);
  const textChanged = useSelector(selectors.textChangedSinceShareSelector);

  return (
    <Fragment>
      <Copied href={permalink}>Permalink to the playground</Copied>
      { gistUrl ? <Copied href={gistUrl}>Direct link to the gist</Copied> : null }
      <Copied href={codeUrl}>Embedded code in link</Copied>
      <NewWindow href={urloUrl}>Open a new thread in the Rust user forum</NewWindow>
      {textChanged ? <Section kind="warning" label="Code changed">
        Source code has been changed since gist was saved
      </Section>: null }
    </Fragment>
  );
};

interface NewWindowProps {
  children: React.ReactNode;
  href: string;
}

const NewWindow: React.FC<NewWindowProps> = props => (
  <p>
    <a href={props.href} target="_blank" rel="noopener noreferrer">{props.children}</a>
  </p>
);

export default Gist;
