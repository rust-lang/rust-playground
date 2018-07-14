import React, { Fragment } from 'react';
import { connect } from 'react-redux';

import { State } from '../reducers';
import { permalinkSelector, showGistLoaderSelector } from '../selectors';
import { Channel, Edition, Mode } from '../types';

import Loader from './Loader';

interface GistProps {
  gistUrl?: string;
  permalink?: string;
  showLoader: boolean;
}

const Gist: React.SFC<GistProps> = props => (
  <div className="output-gist">
    {props.showLoader ? <Loader /> : <Links {...props} />}
  </div>
);

const Links: React.SFC<GistProps> = props => (
  <Fragment>
    <p><a href={props.permalink}>Permalink to the playground</a></p>
    <p><a href={props.gistUrl}>Direct link to the gist</a></p>
  </Fragment>
);

const mapStateToProps = (state: State) => ({
  gistUrl: state.output.gist.url,
  permalink: permalinkSelector(state),
  showLoader: showGistLoaderSelector(state),
});

export default connect(mapStateToProps)(Gist);
