/// React-Ace requires brace on its own and we also need it. This
/// file will be a separate bundle and loaded async so that we only
/// need to load brace a single time.

import ace from 'brace';
import 'brace/ext/language_tools';
import 'brace/ext/searchbox';
import AceEditor from 'react-ace';
import './rust-playground-mode';

export default { AceEditor, ace };
