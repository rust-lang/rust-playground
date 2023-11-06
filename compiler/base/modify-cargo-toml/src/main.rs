extern crate modify_cargo_toml;
extern crate toml;

use modify_cargo_toml::*;
use std::{env, ffi::OsString, fs, path::PathBuf};
use toml::Value;

fn main() {
    let mut args = env::args_os().skip(1).fuse();

    let input_filename = args.next().unwrap_or_else(|| OsString::from("Cargo.toml"));
    let output_filename = args.next().unwrap_or_else(|| input_filename.clone());

    let input_filename = PathBuf::from(input_filename);
    let output_filename = PathBuf::from(output_filename);

    let input = fs::read_to_string(&input_filename)
        .unwrap_or_else(|e| panic!("Cannot read {}: {}", input_filename.display(), e));
    let mut cargo_toml: Value = toml::from_str(&input)
        .unwrap_or_else(|e| panic!("Cannot parse {} as TOML: {}", input_filename.display(), e));

    if env::var_os("PLAYGROUND_FEATURE_EDITION2024").is_some() {
        cargo_toml = set_feature_edition2024(cargo_toml);
    }

    if let Ok(edition) = env::var("PLAYGROUND_EDITION") {
        cargo_toml = set_edition(cargo_toml, &edition);
    }

    if env::var_os("PLAYGROUND_NO_DEPENDENCIES").is_some() {
        cargo_toml = remove_dependencies(cargo_toml);
    }

    if let Ok(crate_type) = env::var("PLAYGROUND_CRATE_TYPE") {
        cargo_toml = set_crate_type(cargo_toml, &crate_type);
    }

    if let Ok(lto) = env::var("PLAYGROUND_RELEASE_LTO") {
        cargo_toml = set_release_lto(cargo_toml, lto == "true");
    }

    let output = toml::to_string(&cargo_toml).expect("Cannot convert back to TOML");

    fs::write(&output_filename, output)
        .unwrap_or_else(|e| panic!("Cannot write to {}: {}", output_filename.display(), e));
}
