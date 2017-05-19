import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import Link from './uss-router/Link';
import Example from './HelpExample';
import { navigateToIndex } from './actions';

import integer32Logo from './assets/integer32-logo.svg';

const ACE_URL = 'https://github.com/ajaxorg/ace';
const CLIPPY_URL = 'https://github.com/Manishearth/rust-clippy';
const CRATES_IO_URL = 'https://crates.io/';
const CRATES_URL = 'https://github.com/integer32llc/rust-playground/blob/master/compiler/base/Cargo.toml';
const GIST_URL = 'https://gist.github.com/';
const I32_URL = 'http://integer32.com/';
const LOCALSTORAGE_URL = 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API';
const OFFICIAL_URL = 'https://play.rust-lang.org/';
const REPO_URL = 'https://github.com/integer32llc/rust-playground';
const RUSTFMT_URL = 'https://github.com/rust-lang-nursery/rustfmt';
const RUSTFMT_RFC_URL = 'https://github.com/rust-lang-nursery/fmt-rfcs';
const SHEPMASTER_URL = 'https://github.com/shepmaster/';

const CRATE_EXAMPLE = `extern crate rand;
use rand::Rng;

fn main() {
    let mut rng = rand::thread_rng();
    println!("{}", rng.gen::<u8>());
}`;

const CLIPPY_EXAMPLE = `fn main() {
    match true {
        true => println!("true"),
        false => println!("false"),
    }
}`;

const RUSTFMT_EXAMPLE = `// wow, this is ugly!
fn main ()
{ struct Foo { a: u8, b: String, }
match 4 {2=>{},_=>{}} }`;

const LINK_EXAMPLE='http://play.integer32.com/?code=fn main() { println!("hello world!"); }';

const TEST_EXAMPLE = `#[test]
fn test_something() {
    assert_ne!(42, 0);
}`;

const LIBRARY_EXAMPLE = `#![crate_type="lib"]

pub fn library_fn() -> u8 {
    42
}`;

const OUTPUT_EXAMPLE = `#[inline(never)]
pub fn a_loop() -> i32 {
    let mut sum = 0;
    for i in 0..100 {
        sum += i;
    }
    sum
}

fn main() {
    println!("{}", a_loop());
}`;

const Help = ({ navigateToIndex }) => (
  <section className="help">
    <h1>The Alternative Rust Playground</h1>
    <Link action={navigateToIndex}>Return to the playground</Link>

    <LinkableSection id="about" header="About" level={H2}>
      <p>
        The playground is an <a href={REPO_URL}>open source project</a>.
        If you have any suggestions for features, issues with the
        implementation, or just want to read the code for yourself,
        you are invited to participate!
      </p>

      <p>
        This playground is modeled after the <a href={OFFICIAL_URL}>official
        Rust playground</a>, and we owe a great debt to every contributor to
        that project.
      </p>

      <p>
        This playground was created by <a href={SHEPMASTER_URL}>Jake Goulding</a>,
        part of <a href={I32_URL}>Integer 32</a>.
      </p>

      <p className="help__logo">
        <a href={I32_URL}>
          <img src={integer32Logo} alt="Integer 32 Logo" />
        </a>
      </p>
    </LinkableSection>


    <LinkableSection id="features" header="Features" level={H2}>
      <LinkableSection id="features-crates" header="Crates" level={H3}>
        <p>
          The playground provides the top 100 most downloaded crates from
          {' '}
          <a href={CRATES_IO_URL}>crates.io</a>. To use a crate, add the
          appropriate <Code>extern crate foo</Code> line to the code.
        </p>

        <Example code={CRATE_EXAMPLE} />

        <p>
          See the <a href={CRATES_URL}>current list of crates</a> to know
          what's available.
        </p>
      </LinkableSection>

      <LinkableSection id="features-linting" header="Linting code" level={H3}>
        <p>
          <a href={CLIPPY_URL}>Clippy</a> is a collection of lints to catch common
          mistakes and improve your Rust code. Click on the
          {' '}
          <strong>Clippy</strong> button to see possible improvements to your
          code.
        </p>

        <Example code={CLIPPY_EXAMPLE} />
      </LinkableSection>

      <LinkableSection id="features-formatting" header="Formatting code" level={H3}>
        <p>
          <a href={RUSTFMT_URL}>rustfmt</a> is a tool for formatting Rust code
          according to the Rust style guidelines. Click on the
          {' '}
          <strong>Format</strong> button to automatically reformat your code.
        </p>

        <Example code={RUSTFMT_EXAMPLE} />

        <p>
          The official Rust style guide is being still being decided via
          {'  '}
          <a href={RUSTFMT_RFC_URL}>the RFC process</a>. During this period, you
          may format your code with the current default formatting or with the
          proposed RFC style by using the drop-down menu.
        </p>
      </LinkableSection>

      <LinkableSection id="features-sharing" header="Sharing code" level={H3}>
        <p>
          Once you have some code worth saving or sharing, click on the
          {' '}
          <strong>Gist</strong> button. This will create an anonymous <a
          href={GIST_URL}>GitHub Gist</a>. You will also be provided with a URL
          to load that Gist back into the playground.
        </p>
      </LinkableSection>

      <LinkableSection id="features-linking" header="Linking to the playground with initial code" level={H3}>
        <p>
          If you have a web page with Rust code that you'd like to
          show in action, you can link to the playground with the
          Rust code in the query parameter <Code>code</Code>. Make sure to
          escape any special characters. Keep the code short, as URLs have
          limitations on the maximum length.
        </p>

        <pre className="help__code"><code>{ LINK_EXAMPLE }</code></pre>
      </LinkableSection>

      <LinkableSection id="features-tests" header="Executing tests" level={H3}>
        <p>
          If your code contains the <Code>#[test]</Code> attribute and does not
          contain a <Code>main</Code> method, <Code>cargo test</Code> will be
          executed instead of <Code>cargo run</Code>.
        </p>

        <Example code={TEST_EXAMPLE} />
      </LinkableSection>

      <LinkableSection id="features-library" header="Compiling as a library" level={H3}>
        <p>
          If your code contains the <Code>#![crate_type="lib"]</Code> attribute,
          {' '}
          <Code>cargo build</Code> will be executed instead of <Code>cargo
          run</Code>.
        </p>

        <Example code={LIBRARY_EXAMPLE} />
      </LinkableSection>

      <LinkableSection id="features-output-formats" header="Output formats" level={H3}>
        <p>
          Instead of compiling to a final binary, you can also see intermediate
          output of the compiler as LLVM IR or x86_64 assembly. This is often used
          in conjunction with the <a href="#features-modes">mode</a> selector set
          to "Release" to see how the compiler has chosen to optimize some
          specific piece of code.
        </p>

        <Example code={OUTPUT_EXAMPLE} />

        <p>
          If you select the nightly channel, you can also output the compiler's
          internal MIR format.
        </p>
      </LinkableSection>

      <LinkableSection id="features-modes" header="Compilation modes" level={H3}>
        <p>
          Rust has two primary compilation modes: <strong>Debug</strong> and
          {' '}
          <strong>Release</strong>. Debug compiles code faster while Release
          performs more aggressive optimizations.
        </p>

        <p>
          You can choose which mode to compile in using the <strong>Mode</strong>
          selector.
        </p>
      </LinkableSection>

      <LinkableSection id="features-channels" header="Rust channels" level={H3}>
        <p>
          Rust releases new <strong>stable</strong> versions every 6
          weeks. Between these stable releases, <strong>beta</strong> versions of the
          next stable release are made available. In addition, builds containing
          experimental features are produced <strong>nightly</strong>.
        </p>

        <p>
          You can choose which channel to compile with using the
          {' '}
          <strong>Channel</strong> selector.
        </p>
      </LinkableSection>

      <LinkableSection id="features-customization" header="Customization" level={H3}>
        <p>
          The <a href={ACE_URL}>Ajax.org Cloud9 Editor (Ace)</a> is used to
          provide a better interface for editing code. Ace comes with
          several keybinding options (such as Emacs and Vim) as well as many
          themes.
        </p>

        <p>
          You may also disable Ace completely, falling back to a
          simple HTML text area.
        </p>

        <p>
          These options can be configured via <strong>Config</strong>.
        </p>
      </LinkableSection>

      <LinkableSection id="features-persistence" header="Persistence" level={H3}>
        <p>
          The most recently entered code will be automatically saved in your browser's
          {' '}
          <a href={LOCALSTORAGE_URL}>local storage</a>. This allows you to recover
          your last work even if you close the browser.
        </p>

        <p>
          Local storage is a singleton resource, so if you use multiple windows,
          only the most recently saved code will be persisted.
         </p>
      </LinkableSection>
    </LinkableSection>

    <LinkableSection id="limitations" header="Limitations" level={H2}>
      <p>
        To prevent the playground from being used to attack other computers and
        to ensure it is available for everyone to use, some limitations
        are enforced.
      </p>

      <dl>
        <dt>Network</dt>
        <dd>
          There is no network connection available during compilation or
          execution of user-submitted code.
        </dd>

        <dt>Memory</dt>
        <dd>
          The amount of memory the compiler and resulting executable use is
          limited.
        </dd>

        <dt>Execution Time</dt>
        <dd>
          The total compilation and execution time is limited.
        </dd>

        <dt>Disk</dt>
        <dd>
          The total disk space available to the compiler and resulting
          executable is limited.
        </dd>
      </dl>
    </LinkableSection>
  </section>
);

Help.propTypes = {
  navigateToIndex: PropTypes.func.isRequired,
};

const H2 = ({ children }) => <h2>{children}</h2>;
H2.propTypes = { children: PropTypes.node };
const H3 = ({ children }) => <h3>{children}</h3>;
H3.propTypes = { children: PropTypes.node };

const LinkableSection = ({ id, header, level: Level, children }) => (
  <div id={id}>
    <Level>
      <span className="help__header">
        <a className="help__header-link" href={`#${id}`}>{header}</a>
      </span>
    </Level>
    {children}
  </div>
);

LinkableSection.propTypes = {
  id: PropTypes.string.isRequired,
  header: PropTypes.string.isRequired,
  level: PropTypes.func.isRequired,
  children: PropTypes.node,
};

const Code = ({ children }) => (
    <code className="help__code">{ children }</code>
);

Code.propTypes = {
  children: PropTypes.node,
};

const mapStateToProps = () => ({
  navigateToIndex,
});

export default connect(mapStateToProps)(Help);
