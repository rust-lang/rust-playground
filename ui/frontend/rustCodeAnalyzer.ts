import { Language, Node, Parser, Query } from 'web-tree-sitter';

export const RUST_LANGUAGE_URL = new URL(
  'node_modules/tree-sitter-rust/tree-sitter-rust.wasm',
  import.meta.url,
);

export interface Analysis {
  hasMain: boolean;
  crateType?: string;
  hasTests: boolean;
}

type AnalysisFn = (code: string) => Analysis;

interface Options {
  getRustLangModuleBytes?: () => Promise<Uint8Array>;
}

const fetchRustLangBytes = async () => {
  const response = await fetch(RUST_LANGUAGE_URL);
  return await response.bytes();
};

export const buildAnalyzer = async (options?: Options): Promise<AnalysisFn> => {
  const parserInit = Parser.init();

  const getBytes = options?.getRustLangModuleBytes ?? fetchRustLangBytes;

  // Perform these two requests in parallel to reduce latency
  const [_, rustLangBytes] = await Promise.all([parserInit, getBytes()]);

  const rustLang = await Language.load(rustLangBytes);

  const parser = new Parser();
  parser.setLanguage(rustLang);

  const hasMainQueryText = `
(
  (function_item
    name: (identifier) @fn-name)
  (#eq? @fn-name "main")
)`;

  const hasMainQuery = new Query(rustLang, hasMainQueryText);

  const hasMain = (root?: Node) => {
    if (!root) {
      return false;
    }

    // Setting `maxStartDepth` to prevent navigating into a module (for example)
    const rr = hasMainQuery.matches(root, { maxStartDepth: 1, matchLimit: 1 });
    return rr.length !== 0;
  };

  const crateTypeQueryText = `
(
  (inner_attribute_item
    (attribute
      (identifier) @attribute-name
      value: (string_literal
               (string_content) @crate-type)))
  (#eq? @attribute-name "crate_type")
)`;
  const crateTypeQuery = new Query(rustLang, crateTypeQueryText);

  const crateType = (root?: Node) => {
    if (!root) {
      return undefined;
    }

    const rr = crateTypeQuery.matches(root, { maxStartDepth: 1, matchLimit: 1 });
    return rr[0]?.captures?.find((c) => c.name === 'crate-type')?.node?.text;
  };

  const hasTestsQueryText = `
(
  (attribute_item
    (attribute
      (identifier) @attribute-name))
  (#eq? @attribute-name "test")
)`;
  const hasTestsQuery = new Query(rustLang, hasTestsQueryText);

  const hasTests = (root?: Node) => {
    if (!root) {
      return false;
    }

    const rr = hasTestsQuery.matches(root, { matchLimit: 1 });
    return rr.length !== 0;
  };

  return (code: string) => {
    // Tree-sitter has smarter ways of updating code as it is edited,
    // but our editor integrations don't currently expose anything
    // useful. For now, let's re-parse every time.
    const tree = parser.parse(code);
    const root = tree?.rootNode;

    return {
      hasMain: hasMain(root),
      crateType: crateType(root),
      hasTests: hasTests(root),
    };
  };
};
