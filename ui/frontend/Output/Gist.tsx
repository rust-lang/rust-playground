import React, { Fragment } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { connect } from 'react-redux';

import { ClipboardIcon } from '../Icon';
import { State } from '../reducers';
import {
  codeUrlSelector,
  issueUrlSelector,
  permalinkSelector,
  showGistLoaderSelector,
  urloUrlSelector,
} from '../selectors';

import Loader from './Loader';

interface GistProps {
  codeUrl?: string;
  gistUrl?: string;
  issueUrl?: string;
  permalink?: string;
  showLoader: boolean;
  urloUrl?: string;
}

const Gist: React.SFC<GistProps> = props => (
  <div className="output-gist">
    {props.showLoader ? <Loader /> : <Links {...props} />}
  </div>
);

const Links: React.SFC<GistProps> = props => (
  <Fragment>
    <Copied href={props.permalink}>Permalink to the playground</Copied>
    <Copied href={props.gistUrl}>Direct link to the gist</Copied>
    <Copied href={props.codeUrl}>Embedded code in link</Copied>
    <p><a href={props.urloUrl} target="_blank">Open a new thread in the Rust user forum</a></p>
    <p><a href={props.issueUrl} target="_blank"> Open an issue on the Rust GitHub repository </a></p>
  </Fragment>
);

interface CopiedProps {
  href: string;
}

interface CopiedState {
  copied: boolean;
}

class Copied extends React.PureComponent<CopiedProps, CopiedState> {
  constructor(props) {
    super(props);
    this.state = { copied: false };
  }

  public render() {
    const copiedClass = this.state.copied ? 'output-gist-copy--active' : '';

    return (
      <p className={`output-gist-copy ${copiedClass}`}>
        <a href={this.props.href} className="output-gist-copy-link">{this.props.children}</a>
        <CopyToClipboard text={this.props.href} onCopy={this.copied}>
          <button className="output-gist-copy-button"><ClipboardIcon /></button>
        </CopyToClipboard>
        <span className="output-gist-copy-text">Copied!</span>
      </p>
    );
  }

  private copied = () => {
    this.setState({ copied: true });
    setTimeout(() => { this.setState({ copied: false }); }, 1000);
  }
}

const mapStateToProps = (state: State) => ({
  codeUrl: codeUrlSelector(state),
  gistUrl: state.output.gist.url,
  issueUrl: issueUrlSelector(state),
  permalink: permalinkSelector(state),
  showLoader: showGistLoaderSelector(state),
  urloUrl: urloUrlSelector(state),
});

export default connect(mapStateToProps)(Gist);
