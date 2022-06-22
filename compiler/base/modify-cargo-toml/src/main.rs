extern crate serde;
#[macro_use]
extern crate serde_derive;
extern crate toml;

use std::{collections::BTreeMap, env, ffi::OsString, fs, path::PathBuf};
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

type Other = BTreeMap<String, Value>;

fn modify<F, T>(cargo_toml: Value, f: F) -> Value
where
    F: FnOnce(T) -> T,
    T: serde::Serialize + for<'de> serde::Deserialize<'de>,
{
    let cargo_toml = cargo_toml.try_into().unwrap();

    let cargo_toml = f(cargo_toml);

    Value::try_from(cargo_toml).unwrap()
}

fn ensure_string_in_vec(values: &mut Vec<String>, val: &str) {
    if !values.iter().any(|f| f == val) {
        values.push(val.into());
    }
}

fn set_edition(cargo_toml: Value, edition: &str) -> Value {
    #[derive(Debug, Serialize, Deserialize)]
    #[serde(rename_all = "kebab-case")]
    struct CargoToml {
        package: Package,
        #[serde(flatten)]
        other: Other,
    }

    #[derive(Debug, Serialize, Deserialize)]
    #[serde(rename_all = "kebab-case")]
    struct Package {
        #[serde(default)]
        edition: String,
        #[serde(flatten)]
        other: Other,
    }

    modify(cargo_toml, |mut cargo_toml: CargoToml| {
        cargo_toml.package.edition = edition.into();
        cargo_toml
    })
}

fn remove_dependencies(cargo_toml: Value) -> Value {
    #[derive(Debug, Serialize, Deserialize)]
    #[serde(rename_all = "kebab-case")]
    struct CargoToml {
        dependencies: BTreeMap<String, Value>,
        #[serde(flatten)]
        other: Other,
    }

    modify(cargo_toml, |mut cargo_toml: CargoToml| {
        cargo_toml.dependencies.clear();
        cargo_toml
    })
}

fn set_crate_type(cargo_toml: Value, crate_type: &str) -> Value {
    #[derive(Debug, Serialize, Deserialize)]
    #[serde(rename_all = "kebab-case")]
    struct CargoToml {
        #[serde(default)]
        lib: Lib,
        #[serde(flatten)]
        other: Other,
    }

    #[derive(Debug, Default, Serialize, Deserialize)]
    #[serde(rename_all = "kebab-case")]
    struct Lib {
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        crate_type: Vec<String>,
        #[serde(default)]
        proc_macro: bool,
        #[serde(flatten)]
        other: Other,
    }

    modify(cargo_toml, |mut cargo_toml: CargoToml| {
        if crate_type == "proc-macro" {
            cargo_toml.lib.proc_macro = true;
        } else {
            ensure_string_in_vec(&mut cargo_toml.lib.crate_type, crate_type);
        }
        cargo_toml
    })
}

fn set_release_lto(cargo_toml: Value, lto: bool) -> Value {
    #[derive(Debug, Serialize, Deserialize)]
    #[serde(rename_all = "kebab-case")]
    struct CargoToml {
        #[serde(default)]
        profile: Profiles,
        #[serde(flatten)]
        other: Other,
    }

    #[derive(Debug, Default, Serialize, Deserialize)]
    #[serde(rename_all = "kebab-case")]
    struct Profiles {
        #[serde(default)]
        release: Profile,
        #[serde(flatten)]
        other: Other,
    }

    #[derive(Debug, Default, Serialize, Deserialize)]
    #[serde(rename_all = "kebab-case")]
    struct Profile {
        #[serde(default)]
        lto: bool,
        #[serde(flatten)]
        other: Other,
    }

    modify(cargo_toml, |mut cargo_toml: CargoToml| {
        cargo_toml.profile.release.lto = lto;
        cargo_toml
    })
}
