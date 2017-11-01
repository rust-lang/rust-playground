import ace from 'brace';
import 'brace/mode/rust';

ace.define('ace/mode/rust-playground', function(require, exports, module) {
  const oop = require('ace/lib/oop');
  const { Mode: RustMode } = require('ace/mode/rust');
  const { RustPlaygroundHighlightRules } = require('ace/mode/rust_playground_highlight_rules');

  const Mode = function() {
    this.HighlightRules = RustPlaygroundHighlightRules;
  };
  oop.inherits(Mode, RustMode);

  (function() {
    // Extra logic goes here.
  }).call(Mode.prototype);

  exports.Mode = Mode;
});

ace.define('ace/mode/rust_playground_highlight_rules', function(require, exports, module) {
  const oop = require('ace/lib/oop');
  const { RustHighlightRules } = require('ace/mode/rust_highlight_rules');

  const RustPlaygroundHighlightRules = function() {
    this.$rules = new RustHighlightRules().getRules();

    // Overriding until the next release that adds the `dyn` token
    const rule = this.$rules.start.find(r => r.token === 'keyword.source.rust');
    // tslint:disable-next-line max-line-length
    rule.regex = '\\b(?:abstract|alignof|as|become|box|break|catch|continue|const|crate|default|do|dyn|else|enum|extern|for|final|if|impl|in|let|loop|macro|match|mod|move|mut|offsetof|override|priv|proc|pub|pure|ref|return|self|sizeof|static|struct|super|trait|type|typeof|union|unsafe|unsized|use|virtual|where|while|yield)\\b';
  };

  oop.inherits(RustPlaygroundHighlightRules, RustHighlightRules);

  exports.RustPlaygroundHighlightRules = RustPlaygroundHighlightRules;
});
