rm -rf build/assets/crate-src/
mkdir build/assets/crate-src/
cd build/assets/crate-src/
syn-file-expand-cli -c unix -c "not(test)" -c "not(no_global_oom_handling)" --loopify $(rustc --print sysroot)/lib/rustlib/src/rust/library/core/src/lib.rs > core_stable_1_58.rs
syn-file-expand-cli -c unix -c "not(test)" -c "not(no_global_oom_handling)" --loopify $(rustc --print sysroot)/lib/rustlib/src/rust/library/alloc/src/lib.rs > alloc_stable_1_58.rs
syn-file-expand-cli -c unix -c "not(test)" -c "not(no_global_oom_handling)" --loopify $(rustc --print sysroot)/lib/rustlib/src/rust/library/std/src/lib.rs > std_stable_1_58.rs
# Switch to beta
syn-file-expand-cli -c unix -c "not(test)" -c "not(no_global_oom_handling)" --loopify $(rustc --print sysroot)/lib/rustlib/src/rust/library/core/src/lib.rs > core_beta_1_59.rs
syn-file-expand-cli -c unix -c "not(test)" -c "not(no_global_oom_handling)" --loopify $(rustc --print sysroot)/lib/rustlib/src/rust/library/alloc/src/lib.rs > alloc_beta_1_59.rs
syn-file-expand-cli -c unix -c "not(test)" -c "not(no_global_oom_handling)" --loopify $(rustc --print sysroot)/lib/rustlib/src/rust/library/std/src/lib.rs > std_beta_1_59.rs
# Switch to nightly
syn-file-expand-cli -c unix -c "not(test)" -c "not(no_global_oom_handling)" --loopify $(rustc --print sysroot)/lib/rustlib/src/rust/library/core/src/lib.rs > core_nightly_2022_03_07.rs
syn-file-expand-cli -c unix -c "not(test)" -c "not(no_global_oom_handling)" --loopify $(rustc --print sysroot)/lib/rustlib/src/rust/library/alloc/src/lib.rs > alloc_nightly_2022_03_07.rs
syn-file-expand-cli -c unix -c "not(test)" -c "not(no_global_oom_handling)" --loopify $(rustc --print sysroot)/lib/rustlib/src/rust/library/std/src/lib.rs > std_nightly_2022_03_07.rs
echo "{" > index.json
echo '"stdlib": [' >> index.json
echo '"stable_1_58",' >> index.json
echo '"beta_1_59",' >> index.json
echo '"nightly_2022_03_07"' >> index.json
echo ']' >> index.json
echo '}' >> index.json
