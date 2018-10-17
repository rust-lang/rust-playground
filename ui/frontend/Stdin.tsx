import React from 'react';
import { connect } from 'react-redux';
import { editStdin } from './actions';

class StdinArea extends React.PureComponent<StdinProps> {
    private onChange = e => this.props.onEditInput(e.target.value);
    public render() {
        return (
            <textarea
                className="stdin-area"
                name="stdin-area"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={this.props.stdin}
                onChange={this.onChange} />
        );
    }
}

export interface StdinProps {
    stdin: string;
    onEditInput: (_: string) => any;
}

const mapStateToProps = ({ stdin }) => (
    { stdin }
);

const mapDispatchToProps = ({
    onEditInput: editStdin
})

const StdinEditor = connect(
    mapStateToProps,
    mapDispatchToProps,
)(StdinArea);

export default StdinEditor;