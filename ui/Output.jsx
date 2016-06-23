import React, { PropTypes } from 'react';

export default class Output extends React.Component {
  render() {
    const { error, code, stdout, stderr, gist } = this.props;

    const links = !gist ? null : (
      <div className="output-links">
        <a href={`/?gist=${gist.id}`}>Share me</a>
        <a href={gist.url}>The gist</a>
      </div>
    );

    return (
      <div>
        <pre className="output-error">
          <code>
            { error }
          </code>
        </pre>
        <hr />
        { links }
        <hr />
        <pre className="output-code">
          <code>
            { code }
          </code>
        </pre>
        <hr />
        <pre className="output-stderr">
          <code>
            { stderr }
          </code>
        </pre>
        <hr />
        <pre className="output-stdout">
          <code>
            { stdout }
          </code>
        </pre>
      </div>
    );
  }
};

Output.propTypes = {
  error: PropTypes.string.isRequired,
  code: PropTypes.string.isRequired,
  stdout: PropTypes.string.isRequired,
  stderr: PropTypes.string.isRequired,
  gist: PropTypes.shape({
    id: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired
  })
};
