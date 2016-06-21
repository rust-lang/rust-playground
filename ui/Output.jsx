import React, { PropTypes } from 'react';

export default class Output extends React.Component {
  render() {
    const { output } = this.props;

    return (
      <pre>
        <code>
          { output }
        </code>
      </pre>
    );
  }
};

Output.propTypes = {
  output: PropTypes.string.isRequired
};
