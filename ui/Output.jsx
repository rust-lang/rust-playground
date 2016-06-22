import React, { PropTypes } from 'react';

export default class Output extends React.Component {
  render() {
    const { stdout, stderr } = this.props;

    return (
      <div>
        <pre>
          <code>
            { stderr }
          </code>
        </pre>
        <hr />
        <pre>
          <code>
            { stdout }
          </code>
        </pre>
      </div>
    );
  }
};

Output.propTypes = {
  stdout: PropTypes.string.isRequired,
  stderr: PropTypes.string.isRequired
};
