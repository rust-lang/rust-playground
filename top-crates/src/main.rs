extern crate cargo;
extern crate reqwest;
#[macro_use]
extern crate lazy_static;
extern crate serde_json;
#[macro_use]
extern crate serde_derive;
extern crate toml;

use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::collections::btree_map::Entry;
use std::fs::File;
use std::io::{Read, Write};

use cargo::core::{Dependency, Package, Source, SourceId};
use cargo::core::registry::PackageRegistry;
use cargo::core::resolver::{self, Method, Resolve};
use cargo::sources::RegistrySource;
use cargo::util::Config;

/// The list of crates from crates.io
#[derive(Debug, Deserialize)]
struct TopCrates {
    crates: Vec<Crate>,
}

/// A single crate from crates.io
#[derive(Debug, Deserialize)]
struct OneCrate {
    #[serde(rename="crate")]
    krate: Crate,
}

/// The shared description of a crate
#[derive(Debug, Deserialize)]
struct Crate {
    #[serde(rename="id")]
    name: String,
}

/// A Cargo.toml file.
#[derive(Serialize)]
struct TomlManifest {
    package: TomlPackage,
    profile: Profiles,
    #[serde(serialize_with = "toml::ser::tables_last")]
    dependencies: BTreeMap<String, DependencySpec>,
}

/// Header of Cargo.toml file.
#[derive(Serialize)]
struct TomlPackage {
    name: String,
    version: String,
    authors: Vec<String>,
}

/// A mapping of a crates name to its identifier used in source code
#[derive(Debug, Serialize)]
struct CrateInformation {
    name: String,
    version: String,
    id: String,
}

/// Hand-curated changes to the crate list
#[derive(Debug, Deserialize)]
struct Modifications {
    #[serde(default)]
    blacklist: Vec<String>,
    #[serde(default)]
    additions: BTreeSet<String>,
}

/// A profile section in a Cargo.toml file
#[derive(Serialize)]
#[serde(rename_all="kebab-case")]
struct Profile {
    codegen_units: u32,
    incremental: bool,
}

/// Available profile types
#[derive(Serialize)]
struct Profiles {
    dev: Profile,
    release: Profile,
}

/// `"1.0.0"` or `{ version = "1.0.0", features = ["..."] }`
#[derive(Serialize, Clone)]
#[serde(untagged)]
enum DependencySpec {
    String(String),
    #[serde(rename_all = "kebab-case")]
    Explicit {
        version: String,
        #[serde(skip_serializing_if = "Vec::is_empty")]
        features: Vec<String>,
        #[serde(skip_serializing_if = "is_true")]
        default_features: bool,
    }
}

impl DependencySpec {
    fn version(&self) -> String {
        match *self {
            DependencySpec::String(ref version) |
            DependencySpec::Explicit { ref version, .. } => version.clone(),
        }
    }
}

fn is_true(b: &bool) -> bool {
    *b
}

impl Modifications {
    fn blacklisted(&self, name: &str) -> bool {
        self.blacklist.iter().any(|n| n == name)
    }
}

lazy_static! {
    static ref MODIFICATIONS: Modifications = {
        let mut f = File::open("crate-modifications.toml")
            .expect("unable to open crate modifications file");

        let mut d = Vec::new();
        f.read_to_end(&mut d)
            .expect("unable to read crate modifications file");

        toml::from_slice(&d)
            .expect("unable to parse crate modifications file")
    };
}

impl TopCrates {
    /// List top 100 crates by number of downloads on crates.io.
    fn download() -> TopCrates {
        let resp =
            reqwest::get("https://crates.io/api/v1/crates?page=1&per_page=100&sort=downloads")
            .expect("Could not fetch top crates");
        assert!(resp.status().is_success());

        serde_json::from_reader(resp).expect("Invalid JSON")
    }

    /// Add crates that have been hand-picked
    fn add_curated_crates(&mut self) {
        self.crates.extend({
            MODIFICATIONS
                .additions
                .iter()
                .cloned()
                .map(|name| Crate { name })
        });
    }
}

fn unique_latest_crates(resolve: Resolve) -> BTreeMap<String, DependencySpec> {
    let mut uniqs = BTreeMap::new();
    for pkg in resolve.iter() {
        if MODIFICATIONS.blacklisted(pkg.name().as_str()) {
            continue;
        }

        match uniqs.entry(pkg.name()) {
            Entry::Vacant(entry) => {
                // First time seeing this package.
                entry.insert(pkg.version());
            }
            Entry::Occupied(mut entry) => {
                // Seen before, keep the newest version.
                if &pkg.version() > entry.get() {
                    entry.insert(pkg.version());
                }
            }
        }
    }

    uniqs.into_iter()
         .map(|(name, version)| (
             name.to_string(),
             DependencySpec::String(version.to_string()),
         ))
         .collect()
}

/// Updates `dep` to include features specified by the custom metadata of `pkg`.
///
/// Our custom metadata format looks like:
///
///     [package.metadata.playground]
///     default-features = true
///     features = ["std", "extra-traits"]
///     all-features = false
///
/// All fields are optional.
fn fill_playground_metadata_features(dep: &mut DependencySpec, pkg: &Package) {
    let custom_metadata = match pkg.manifest().custom_metadata() {
        Some(custom_metadata) => custom_metadata,
        None => return,
    };

    let playground_metadata = match custom_metadata.get("playground") {
        Some(playground_metadata) => playground_metadata,
        None => return,
    };

    #[derive(Deserialize)]
    #[serde(default, rename_all = "kebab-case")]
    struct Metadata {
        features: Vec<String>,
        default_features: bool,
        all_features: bool,
    }

    impl Default for Metadata {
        fn default() -> Self {
            Metadata {
                features: Vec::new(),
                default_features: true,
                all_features: false,
            }
        }
    }

    let metadata = match playground_metadata.clone().try_into::<Metadata>() {
        Ok(metadata) => metadata,
        Err(err) => {
            eprintln!(
                "Failed to parse custom metadata for {} {}: {}",
                pkg.name(), pkg.version(), err);
            return;
        }
    };

    // If `all-features` is set then we ignore `features`.
    let summary = pkg.summary();
    let mut enabled_features: BTreeSet<String> = if metadata.all_features {
        summary.features().keys().cloned().collect()
    } else {
        metadata.features.into_iter().collect()
    };

    // If not opting out of default features, remove default features from the
    // explicit features list. This avoids ongoing spurious diffs in our
    // generated Cargo.toml as default features are added to a library.
    if metadata.default_features {
        if let Some(default_feature_names) = summary.features().get("default") {
            enabled_features.remove("default");
            for feature in default_feature_names {
                enabled_features.remove(&feature.to_string(summary));
            }
        }
    }

    if !enabled_features.is_empty() || !metadata.default_features {
        *dep = DependencySpec::Explicit {
            version: dep.version(),
            features: enabled_features.into_iter().collect(),
            default_features: metadata.default_features,
        };
    }
}

fn write_manifest(manifest: TomlManifest, path: &str) {
    let mut f = File::create(path).expect("Unable to create Cargo.toml");
    let content = toml::to_vec(&manifest).expect("Couldn't serialize TOML");
    f.write_all(&content).expect("Couldn't write Cargo.toml");
}

fn main() {
    // Setup to interact with cargo.
    let config = Config::default().expect("Unable to create default Cargo config");
    let crates_io = SourceId::crates_io(&config).expect("Unable to create crates.io source ID");
    let mut source = RegistrySource::remote(&crates_io, &config);
    source.update().expect("Unable to update registry");

    let mut top = TopCrates::download();
    top.add_curated_crates();

    // Find the newest (non-prerelease, non-yanked) versions of all
    // the interesting crates.
    let mut summaries = Vec::new();
    for Crate { ref name } in top.crates {
        if MODIFICATIONS.blacklisted(name) {
            continue;
        }

        // Query the registry for a summary of this crate.
        // Usefully, this doesn't seem to include yanked versions
        let dep = Dependency::parse_no_deprecated(name, None, &crates_io)
            .unwrap_or_else(|e| panic!("Unable to parse dependency for {}: {}", name, e));

        let matches = source.query_vec(&dep).unwrap_or_else(|e| {
            panic!("Unable to query registry for {}: {}", name, e);
        });

        // Find the newest non-prelease version
        let summary = matches.into_iter()
            .filter(|summary| !summary.version().is_prerelease())
            .max_by_key(|summary| summary.version().clone())
            .unwrap_or_else(|| panic!("Registry has no viable versions of {}", name));

        // Add a dependency on this crate.
        summaries.push((summary, Method::Required {
            dev_deps: false,
            features: &[],
            uses_default_features: true,
            all_features: false,
        }));
    }

    // Resolve transitive dependencies.
    let mut registry = PackageRegistry::new(&config)
        .expect("Unable to create package registry");
    registry.lock_patches();
    let try_to_use = HashSet::new();
    let res = resolver::resolve(&summaries, &[], &mut registry, &try_to_use, None, true)
        .expect("Unable to resolve dependencies");

    // Construct playground's Cargo.toml.
    let mut unique_latest_crates = unique_latest_crates(res);

    let mut infos = Vec::new();

    for (name, spec) in &mut unique_latest_crates {
        let version = spec.version();

        let pkgid = cargo::core::PackageId::new(&name, &version, &crates_io)
            .unwrap_or_else(|e| panic!("Unable to build PackageId for {} {}: {}", name, version, e));

        let pkg = source.download(&pkgid)
            .unwrap_or_else(|e| panic!("Unable to download {} {}: {}", name, version, e));

        for target in pkg.targets() {
            if let cargo::core::TargetKind::Lib(_) = *target.kind() {
                infos.push(CrateInformation {
                    name: name.clone(),
                    version: version.clone(),
                    id: target.crate_name()
                })
            }
        }

        fill_playground_metadata_features(spec, &pkg);
    }

    let manifest = TomlManifest {
        package: TomlPackage {
            name: "playground".to_owned(),
            version: "0.0.1".to_owned(),
            authors: vec!["The Rust Playground".to_owned()],
        },
        profile: Profiles {
            dev: Profile { codegen_units: 1, incremental: false },
            release: Profile { codegen_units: 1, incremental: false },
        },
        dependencies: unique_latest_crates,
    };

    // Write manifest file.
    let cargo_toml = "../compiler/base/Cargo.toml";
    write_manifest(manifest, cargo_toml);
    println!("wrote {}", cargo_toml);

    let path = "../compiler/base/crate-information.json";
    let mut f = File::create(path)
        .unwrap_or_else(|e| panic!("Unable to create {}: {}", path, e));
    serde_json::to_writer_pretty(&mut f, &infos)
        .unwrap_or_else(|e| panic!("Unable to write {}: {}", path, e));
    println!("Wrote {}", path);
}
