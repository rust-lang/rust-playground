#![deny(rust_2018_idioms)]

use cargo::{
    core::{
        compiler::{CompileKind, CompileTarget, TargetInfo},
        package::PackageSet,
        registry::PackageRegistry,
        resolver::{self, features::RequestedFeatures, ResolveOpts},
        source::SourceMap,
        Dependency, Package, Source, SourceId, TargetKind,
    },
    sources::RegistrySource,
    util::{Config, VersionExt},
};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet, HashSet},
    io::Read, task::Poll,
};

const PLAYGROUND_TARGET_PLATFORM: &str = "x86_64-unknown-linux-gnu";

/// The list of crates from crates.io
#[derive(Debug, Deserialize)]
struct TopCrates {
    crates: Vec<Crate>,
}

/// The shared description of a crate
#[derive(Debug, Deserialize)]
struct Crate {
    #[serde(rename = "id")]
    name: String,
}

/// A mapping of a crates name to its identifier used in source code
#[derive(Debug, Serialize)]
pub struct CrateInformation {
    pub name: String,
    pub version: String,
    pub id: String,
}

/// Hand-curated changes to the crate list
#[derive(Debug, Default, Deserialize)]
pub struct Modifications {
    #[serde(default)]
    pub exclusions: Vec<String>,
    #[serde(default)]
    pub additions: BTreeSet<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub struct DependencySpec {
    #[serde(skip_serializing_if = "String::is_empty")]
    pub package: String,
    #[serde(serialize_with = "exact_version")]
    pub version: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub features: Vec<String>,
    #[serde(skip_serializing_if = "is_true")]
    pub default_features: bool,
}

fn exact_version<S>(version: &String, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    format!("={}", version).serialize(serializer)
}

fn is_true(b: &bool) -> bool {
    *b
}

impl Modifications {
    fn excluded(&self, name: &str) -> bool {
        self.exclusions.iter().any(|n| n == name)
    }
}

fn simple_get(url: &str) -> reqwest::Result<reqwest::blocking::Response> {
    reqwest::blocking::ClientBuilder::new()
        .user_agent("Rust Playground - Top Crates Utility")
        .build()?
        .get(url)
        .send()
}

impl TopCrates {
    /// List top 100 crates by number of downloads on crates.io.
    fn download() -> TopCrates {
        let resp =
            simple_get("https://crates.io/api/v1/crates?page=1&per_page=100&sort=downloads")
                .expect("Could not fetch top crates");
        assert!(resp.status().is_success(), "Could not download top crates; HTTP status was {}", resp.status());

        serde_json::from_reader(resp).expect("Invalid JSON")
    }

    fn add_rust_cookbook_crates(&mut self) {
        let mut resp = simple_get(
            "https://raw.githubusercontent.com/rust-lang-nursery/rust-cookbook/master/Cargo.toml",
        )
        .expect("Could not fetch cookbook manifest");
        assert!(resp.status().is_success(), "Could not download cookbook; HTTP status was {}", resp.status());

        let mut content = String::new();
        resp.read_to_string(&mut content)
            .expect("could not read cookbook manifest");

        let manifest = content
            .parse::<toml::Value>()
            .expect("could not parse cookbook manifest");

        let dependencies = manifest["dependencies"]
            .as_table()
            .expect("no dependencies found for cookbook manifest");
        self.crates.extend({
            dependencies.iter().map(|(name, _)| Crate {
                name: name.to_string(),
            })
        })
    }

    /// Add crates that have been hand-picked
    fn add_curated_crates(&mut self, modifications: &Modifications) {
        self.crates.extend({
            modifications
                .additions
                .iter()
                .cloned()
                .map(|name| Crate { name })
        });
    }
}

/// Finds the features specified by the custom metadata of `pkg`.
///
/// Our custom metadata format looks like:
///
///     [package.metadata.playground]
///     default-features = true
///     features = ["std", "extra-traits"]
///     all-features = false
///
/// All fields are optional.
fn playground_metadata_features(pkg: &Package) -> Option<(Vec<String>, bool)> {
    let custom_metadata = pkg.manifest().custom_metadata()?;
    let playground_metadata = custom_metadata.get("playground")?;

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
                pkg.name(),
                pkg.version(),
                err
            );
            return None;
        }
    };

    // If `all-features` is set then we ignore `features`.
    let summary = pkg.summary();
    let mut enabled_features: BTreeSet<String> = if metadata.all_features {
        summary.features().keys().map(ToString::to_string).collect()
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
                enabled_features.remove(&feature.to_string());
            }
        }
    }

    if !enabled_features.is_empty() || !metadata.default_features {
        Some((
            enabled_features.into_iter().collect(),
            metadata.default_features,
        ))
    } else {
        None
    }
}

pub fn generate_info(modifications: &Modifications) -> (BTreeMap<String, DependencySpec>, Vec<CrateInformation>) {
    // Setup to interact with cargo.
    let config = Config::default().expect("Unable to create default Cargo config");
    let _lock = config.acquire_package_cache_lock();
    let crates_io = SourceId::crates_io(&config).expect("Unable to create crates.io source ID");
    let mut source = RegistrySource::remote(crates_io, &HashSet::new(), &config).expect("Unable to create registry source");
    source.invalidate_cache();
    source.block_until_ready().expect("Unable to wait for registry to be ready");

    let mut top = TopCrates::download();
    top.add_rust_cookbook_crates();
    top.add_curated_crates(modifications);

    // Find the newest (non-prerelease, non-yanked) versions of all
    // the interesting crates.
    let mut summaries = Vec::new();
    for Crate { name } in &top.crates {
        if modifications.excluded(name) {
            continue;
        }

        // Query the registry for a summary of this crate.
        // Usefully, this doesn't seem to include yanked versions
        let dep = Dependency::parse(name, None, crates_io)
            .unwrap_or_else(|e| panic!("Unable to parse dependency for {}: {}", name, e));

        let matches = match source.query_vec(&dep) {
            Poll::Ready(Ok(v)) => v,
            Poll::Ready(Err(e)) => panic!("Unable to query registry for {}: {}", name, e),
            Poll::Pending => panic!("Registry not ready to query"),
        };

        // Find the newest non-prelease version
        let summary = matches
            .into_iter()
            .filter(|summary| !summary.version().is_prerelease())
            .max_by_key(|summary| summary.version().clone())
            .unwrap_or_else(|| panic!("Registry has no viable versions of {}", name));

        // Add a dependency on this crate.
        summaries.push((
            summary,
            ResolveOpts {
                dev_deps: false,
                features: RequestedFeatures::DepFeatures {
                    features: Default::default(),
                    uses_default_features: true,
                },
            },
        ));
    }

    // Resolve transitive dependencies.
    let mut registry = PackageRegistry::new(&config).expect("Unable to create package registry");
    registry.lock_patches();
    let try_to_use = Default::default();
    let resolve = resolver::resolve(&summaries, &[], &mut registry, &try_to_use, None, true)
        .expect("Unable to resolve dependencies");

    // Find crates incompatible with the playground's platform
    let mut valid_for_our_platform: BTreeSet<_> = summaries.iter().map(|(s, _)| s.package_id()).collect();

    let ct = CompileTarget::new(PLAYGROUND_TARGET_PLATFORM).expect("Unable to create a CompileTarget");
    let ck = CompileKind::Target(ct);
    let rustc = config.load_global_rustc(None).expect("Unable to load the global rustc");

    let ti = TargetInfo::new(&config, &[ck], &rustc, ck).expect("Unable to create a TargetInfo");
    let cc = ti.cfg();

    let mut to_visit = valid_for_our_platform.clone();

    while !to_visit.is_empty() {
        let mut visit_next = BTreeSet::new();

        for package_id in to_visit {
            for (dep_pkg, deps) in resolve.deps(package_id) {

                let for_this_platform = deps.iter().any(|dep| {
                    dep.platform().map_or(true, |platform| platform.matches(PLAYGROUND_TARGET_PLATFORM, cc))
                });

                if for_this_platform {
                    valid_for_our_platform.insert(dep_pkg);
                    visit_next.insert(dep_pkg);
                }
            }
        }

        to_visit = visit_next;
    }

    // Remove invalid and excluded packages that have been added due to resolution
    let package_ids: Vec<_> = resolve
        .iter()
        .filter(|pkg| valid_for_our_platform.contains(pkg))
        .filter(|pkg| !modifications.excluded(pkg.name().as_str()))
        .collect();

    let mut sources = SourceMap::new();
    sources.insert(Box::new(source));

    let package_set =
        PackageSet::new(&package_ids, sources, &config).expect("Unable to create a PackageSet");

    let mut packages = package_set
        .get_many(package_set.package_ids())
        .expect("Unable to download packages");

    // Sort all packages by name then version (descending), so that
    // when we group them we know we get all the same crates together
    // and the newest version first.
    packages.sort_by(|a, b| {
        a.name()
            .cmp(&b.name())
            .then(a.version().cmp(&b.version()).reverse())
    });

    let mut dependencies = BTreeMap::new();
    let mut infos = Vec::new();

    for (name, pkgs) in &packages.into_iter().group_by(|pkg| pkg.name()) {
        let mut first = true;

        for pkg in pkgs {
            let version = pkg.version();

            let crate_name = pkg
                .targets()
                .iter()
                .flat_map(|target| match target.kind() {
                    TargetKind::Lib(_) => Some(target.crate_name()),
                    _ => None,
                })
                .next()
                .unwrap_or_else(|| panic!("{} did not have a library", name));

            // We see the newest version first. Any subsequent
            // versions will have their version appended so that they
            // are uniquely named
            let exposed_name = if first {
                crate_name.clone()
            } else {
                format!(
                    "{}_{}_{}_{}",
                    crate_name, version.major, version.minor, version.patch
                )
            };

            let (features, default_features) =
                playground_metadata_features(&pkg).unwrap_or_else(|| (Vec::new(), true));

            dependencies.insert(
                exposed_name.clone(),
                DependencySpec {
                    package: name.to_string(),
                    version: version.to_string(),
                    features,
                    default_features,
                },
            );

            infos.push(CrateInformation {
                name: name.to_string(),
                version: version.to_string(),
                id: exposed_name,
            });

            first = false;
        }
    }

    (dependencies, infos)
}
