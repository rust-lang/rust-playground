import * as qs from 'qs';
import React from 'react';

import { Channel, Edition, Mode } from '../types';

import Loader from './Loader';

interface GistProps {
  requestsInProgress: number;
  id?: string;
  url?: string;
  channel?: Channel;
  mode?: Mode;
  edition?: Edition;
}

const Gist: React.SFC<GistProps> = props => {
  const loader = (props.requestsInProgress > 0) ? <Loader /> : null;
  let permalink = null;
  if (props.id) {
    const q = {
      gist: props.id,
      version: props.channel,
      mode: props.mode,
      edition: props.edition,
    };
    permalink = <p><a href={`/?${qs.stringify(q)}`}>Permalink to the playground</a></p>;
  }
  const directLink = props.url ? (<p><a href={props.url}>Direct link to the gist</a></p>) : null;

  return (
    <div className="output-gist">
      {loader}
      {permalink}
      {directLink}
    </div>
  );
};

export default Gist;
