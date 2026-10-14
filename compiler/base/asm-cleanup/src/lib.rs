// Thanks to Matt Godbolt for creating the amazing Compiler Explorer https://www.godbolt.org
// This aims to provide similar assembly cleanup to what Godbolt does

use petgraph::prelude::*;
use regex::{Captures, Regex};
use rustc_demangle::demangle;
use std::{collections::HashSet, sync::LazyLock};

pub fn demangle_asm(block: &str) -> String {
    static DEMANGLE_REGEX: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"_[a-zA-Z0-9._$]*").unwrap());

    DEMANGLE_REGEX
        .replace_all(block, |caps: &Captures<'_>| {
            format!("{:#}", demangle(caps.get(0).map_or("", |m| m.as_str())))
        })
        .to_string()
}

enum LineType<'a> {
    Opcode,
    LabelDecl(&'a str),
    Data(&'a str),
    FunctionDecl,
    Directive,
    Blank,
    Misc,
}

// Removes unused labels and directives from assembly
pub fn filter_asm(block: &str) -> String {
    use self::LineType::*;

    // Example:    mov rax, rdx
    // Always inlude in results
    static OPCODE_REGEX: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"^\s+[a-zA-Z]+.*[^:]$").unwrap());

    // Example:.Lfunc_end7:
    // Finds label declarations
    // Include in results only if it is referenced by an opcode, or is a function
    static LABEL_DECL_REGEX: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"^([a-zA-Z_.<][a-zA-Z0-9$&_.,<>\[\]{}:' ]*):(\s+#.*)?$").unwrap()
    });

    // Example:    mov lea rdi, [rip + str.0] // str.0 is the referenced label
    // Find labels used as operands for an opcode
    static LABEL_REF_REGEX: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"([a-zA-Z_.][a-zA-Z0-9$_.]*)").unwrap());

    // Example:    .string "Hello, world!"
    // Note: this is a type of directive
    // Include in results if it is part of a used label, may contain label references
    static DATA_REGEX: LazyLock<Regex> = LazyLock::new(|| {
        Regex::new(r"^\s+\.(string|asciz|ascii|[1248]?byte|short|word|long|quad|value|zero)")
            .unwrap()
    });

    // Example:    .type main,@function
    // Note: this is a type of directive
    // Never include in results, but is used to find and include functions
    static FUNCTION_REGEX: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"^\s+\.type\s*(.*),@function$").unwrap());

    // Example:    .p2align 4, 0x90
    // Note: this will also match entries found by DATA_REGEX and FUNCTION_REGEX
    // Never include in results
    static DIRECTIVE_REGEX: LazyLock<Regex> =
        LazyLock::new(|| Regex::new(r"^\s+\..*[^:]$").unwrap());

    // Never include in results
    static BLANK_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\s*$").unwrap());

    let mut current_label = "";
    let mut line_info = Vec::new();
    let mut labels = HashSet::new();
    let mut opcode_operands = HashSet::new();
    let mut label_graph: DiGraphMap<_, _> = Default::default();

    // Note the type of data held on each line of the block
    for line in block.lines() {
        if OPCODE_REGEX.is_match(line) {
            line_info.push(Opcode);
            // Skip the opcode, just add operands
            for label_ref_cap in LABEL_REF_REGEX
                .captures_iter(line)
                .skip(1)
                .filter_map(|cap| cap.get(1))
            {
                opcode_operands.insert(label_ref_cap.as_str());
            }
        } else if let Some(label_decl_cap) =
            LABEL_DECL_REGEX.captures(line).and_then(|cap| cap.get(1))
        {
            line_info.push(LabelDecl(label_decl_cap.as_str()));
            labels.insert(label_decl_cap.as_str());
            current_label = label_decl_cap.as_str();
        } else if DATA_REGEX.is_match(line) && !current_label.is_empty() {
            line_info.push(Data(current_label));
            // These will be checked for references to other labels later on
            // Skip the data type, just capture its reference
            for label_ref_cap in LABEL_REF_REGEX
                .captures_iter(line)
                .skip(1)
                .filter_map(|cap| cap.get(1))
            {
                // Create a graph of how data labels reference each other
                label_graph.add_edge(current_label, label_ref_cap.as_str(), 1);
            }
        } else if let Some(function_cap) = FUNCTION_REGEX.captures(line).and_then(|cap| cap.get(1))
        {
            line_info.push(FunctionDecl);
            opcode_operands.insert(function_cap.as_str());
        // DIRECTIVE_REGEX must be checked after FUNCTION_REGEX and DATA_REGEX, matches them too
        } else if DIRECTIVE_REGEX.is_match(line) {
            line_info.push(Directive);
        } else if BLANK_REGEX.is_match(line) {
            line_info.push(Blank);
        // If no matches are found then include line in output
        } else {
            line_info.push(Misc);
        }
    }

    let mut data_labels = Vec::new();
    let mut used_labels: HashSet<_> = labels.intersection(&opcode_operands).collect();

    // We only include labels ref'd by data dirs if directly or indirectly used by an opcode
    for label in &used_labels {
        if label_graph.contains_node(label) {
            let mut label_search = Dfs::new(&label_graph, label);
            while let Some(next_label) = label_search.next(&label_graph) {
                data_labels.push(next_label);
            }
        }
    }

    used_labels.extend(&data_labels);

    let mut filtered_asm = String::new();
    for (line, line_type) in block.lines().zip(&line_info) {
        match *line_type {
            Opcode | Misc => {
                filtered_asm.push_str(line);
                filtered_asm.push('\n');
            }
            Data(data) if used_labels.contains(&data) => {
                filtered_asm.push_str(line);
                filtered_asm.push('\n');
            }
            LabelDecl(label) if used_labels.contains(&label) => {
                filtered_asm.push('\n');
                filtered_asm.push_str(line);
                filtered_asm.push('\n');
            }
            _ => (),
        }
    }

    filtered_asm
}

#[cfg(test)]
mod test {
    macro_rules! assert_demangled {
        ($input:literal, $expected:literal $(,)?) => {
            let output = super::demangle_asm($input);
            assert_eq!(output, $expected);
        };
    }

    #[test]
    fn demangles() {
        assert_demangled!(
            "_ZN4core3fmt9Arguments6new_v117h3c6f806acbe1ddabE",
            "core::fmt::Arguments::new_v1",
        );
    }

    #[test]
    fn many_demangles() {
        assert_demangled!(
            r#"
.section.text._ZN4core3fmt9Arguments6new_v117h3c6f806acbe1ddabE,"ax",@progbits
 .p2align4, 0x90
 .type_ZN4core3fmt9Arguments6new_v117h3c6f806acbe1ddabE,@function
"#,
            r#"
.section.text.core::fmt::Arguments::new_v1,"ax",@progbits
 .p2align4, 0x90
 .typecore::fmt::Arguments::new_v1,@function
"#,
        );
    }

    #[test]
    fn demangle_pass_through() {
        assert_demangled!(
            r#"
push rbp
 mov rbp, rsp
"#,
            r#"
push rbp
 mov rbp, rsp
"#,
        );
    }

    macro_rules! assert_filtered {
        ($input:literal, $expected:literal $(,)?) => {
            let output = super::filter_asm($input);
            assert_eq!(output.trim(), $expected.trim());
        };
    }

    #[test]
    fn one_directive_removed() {
        assert_filtered!(
            r#"
  .filesystem1 "<println macros>"
  movq%rsp, %rbp
"#,
            r#"  movq%rsp, %rbp"#,
        );
    }

    #[test]
    fn many_directives_removed() {
        assert_filtered!(
            r#"
 .cfi_def_cfa_register %rbp
 subq$80, %rsp
 .text
"#,
            r#"
 subq$80, %rsp
"#,
        );
    }

    #[test]
    fn used_label_kept() {
        assert_filtered!(
            r#"
.Lcfi0:
  callq    .Lcfi0
"#,
            r#"
.Lcfi0:
  callq    .Lcfi0
"#,
        );
    }

    #[test]
    fn unused_label_removed() {
        assert_filtered!(
            r#"
    addq    $16, %rsp
    popq    %rbp
    retq
.Lfunc_end31:
str.0:
"#,
            r#"
    addq    $16, %rsp
    popq    %rbp
    retq
"#,
        );
    }

    #[test]
    fn used_data_kept() {
        assert_filtered!(
            r#"
ref.2:
  .quad 1
  jmp ref.2
"#,
            r#"
ref.2:
  .quad 1
  jmp ref.2
"#,
        );
    }

    #[test]
    fn unused_data_removed() {
        assert_filtered!(
            r#"
str.0:
  .ascii "Hello, world"
  pop rbp
"#,
            r#"
  pop rbp
"#,
        );
    }

    #[test]
    fn blank_lines_removed() {
        assert_filtered!(
            r#"
  mov rbp, rsp
main:
  jmp core::fmt::Arguments
"#,
            r#"
  mov rbp, rsp
  jmp core::fmt::Arguments
"#,
        );
    }

    #[test]
    fn functions_kept() {
        assert_filtered!(
            r#"
  .type main,@function
main:
  pushq %rax
"#,
            r#"
main:
  pushq %rax
"#,
        );
    }

    #[test]
    fn used_data_ref_label_kept() {
        assert_filtered!(
            r#"
.Lcfi0:
  .quad .Lcfi1
  mov .Lcfi0
.Lcfi1:
  addq $16, %rsp
"#,
            r#"
.Lcfi0:
  .quad .Lcfi1
  mov .Lcfi0

.Lcfi1:
  addq $16, %rsp
"#,
        );
    }

    #[test]
    fn unused_data_ref_label_removed() {
        assert_filtered!(
            r#"
.Lcfi0:
  .quad 1
  mov .Lcfi0
.Lcfi1:
  addq $16, %rsp
"#,
            r#"
.Lcfi0:
  .quad 1
  mov .Lcfi0
  addq $16, %rsp
"#,
        );
    }

    #[test]
    fn unused_data_label_referencing_used_data_label_is_removed() {
        assert_filtered!(
            r#"
  move ref.used
ref.unused:
  .quad ref.used
ref.used:
  .quad 1
"#,
            r#"
  move ref.used

ref.used:
  .quad 1
"#,
        );
    }

    #[test]
    fn data_label_only_used_by_unused_data_label_is_removed() {
        assert_filtered!(
            r#"
  move rax
ref.unused.1:
  .quad ref.unused.2
ref.unused.2:
  .quad 1
"#,
            r#"
  move rax
"#,
        );
    }

    #[test]
    fn used_data_ref_label_graph_walk() {
        assert_filtered!(
            r#"
main:
  .quad ref.1
  mov main
ref.1:
  .quad ref.2
ref.2:
  .quad 1
"#,
            r#"
main:
  .quad ref.1
  mov main

ref.1:
  .quad ref.2

ref.2:
  .quad 1
"#,
        );
    }

    #[test]
    fn cycle_of_two_labels() {
        assert_filtered!(
            r#"
  mov ref.1
ref.1:
  .quad ref.2
ref.2:
  .quad ref.1
"#,
            r#"
  mov ref.1

ref.1:
  .quad ref.2

ref.2:
  .quad ref.1
"#,
        );
    }

    #[test]
    fn cycle_of_one_label() {
        assert_filtered!(
            r#"
  mov ref.1
ref.1:
  .quad ref.1
"#,
            r#"
  mov ref.1

ref.1:
  .quad ref.1
"#,
        );
    }

    #[test]
    fn labels_in_a_diamond() {
        assert_filtered!(
            r#"
  mov ref.start
ref.start:
  add ref.left, ref.right
ref.left:
  mov ref.end
ref.right:
  mov ref.end
ref.end:
  .quad 1
"#,
            r#"
  mov ref.start

ref.start:
  add ref.left, ref.right

ref.left:
  mov ref.end

ref.right:
  mov ref.end

ref.end:
  .quad 1
"#,
        );
    }

    #[test]
    fn label_with_comment_recognized() {
        assert_filtered!(
            r#"
.LBB6_10:  # =>Comment
 movq %r15, %rsi
 movq %rbx, %rdx
 ja .LBB6_10
"#,
            r#"
.LBB6_10:  # =>Comment
 movq %r15, %rsi
 movq %rbx, %rdx
 ja .LBB6_10
"#,
        );
    }

    #[test]
    fn comment_retained() {
        assert_filtered!(
            r#"
# %bb.0:
 subq $24, %rsp
"#,
            r#"
# %bb.0:
 subq $24, %rsp
"#,
        );
    }
}
