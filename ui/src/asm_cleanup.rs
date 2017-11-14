use regex::Regex;
use regex::Captures;
use rustc_demangle::demangle;

pub fn remove_assembler_directives(block: &str) -> String {
    lazy_static! {
        static ref ASM_DIR_REGEX: Regex = Regex::new(r"(?m)^\s*\..*$").expect("Failed to create ASM_DIR_REGEX");
    }

    let mut filtered_asm = String::new();
    for line in block.lines() {
        if !ASM_DIR_REGEX.is_match(line) {
            filtered_asm.push_str(line);
            filtered_asm.push('\n');
        }
    }

    filtered_asm
}

pub fn demangle_asm(block: &str) -> String {
    lazy_static! {
        static ref DEMANGLE_REGEX: Regex = Regex::new(r"_[a-zA-Z0-9._$]*").expect("Failed to create DEMANGLE_REGEX");
    }

    DEMANGLE_REGEX.replace_all(block, |caps: &Captures| {
        format!("{:#}", demangle(caps.get(0)
                                     .expect("Failed to find symbols to demangle")
                                     .as_str()))
    }).to_string()
}

#[cfg(test)]
mod test {
    #[test]
    fn directives_pass_through() {
        assert_eq!(
            super::remove_assembler_directives("core::fmt::Arguments::new_v1:\n push rbp\n mov rbp, rsp"),
            "core::fmt::Arguments::new_v1:\n push rbp\n mov rbp, rsp\n");
    }

    #[test]
    fn one_directive_removed() {
        assert_eq!(
            super::remove_assembler_directives("  .filesystem1 \"<println macros>\"\n  movq%rsp, %rbp\n"),
            "  movq%rsp, %rbp\n");
    }

    #[test]
    fn many_directives_removed() {
        assert_eq!(
            super::remove_assembler_directives(" .cfi_def_cfa_register %rbp\n subq$80, %rsp\n .Ltmp2:"),
            " subq$80, %rsp\n");
    }

    #[test]
    fn demangle_pass_through() {
        assert_eq!(
            super::demangle_asm("push rbp\n mov rbp, rsp"),
            "push rbp\n mov rbp, rsp");
    }

    #[test]
    fn demangles() {
        assert_eq!(
            super::demangle_asm("_ZN4core3fmt9Arguments6new_v117h3c6f806acbe1ddabE"),
            "core::fmt::Arguments::new_v1");
        }

    #[test]
    fn many_demangles() {
        assert_eq!(
            super::demangle_asm(".section.text._ZN4core3fmt9Arguments6new_v117h3c6f806acbe1ddabE,\"ax\",@progbits\n .p2align4, 0x90\n .type_ZN4core3fmt9Arguments6new_v117h3c6f806acbe1ddabE,@function"),
            ".section.text.core::fmt::Arguments::new_v1,\"ax\",@progbits\n .p2align4, 0x90\n .typecore::fmt::Arguments::new_v1,@function");
        }
    
}
