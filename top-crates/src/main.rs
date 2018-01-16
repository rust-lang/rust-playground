extern crate cargo;
extern crate reqwest;
#[macro_use]
extern crate lazy_static;
extern crate serde_json;
#[macro_use]
extern crate serde_derive;
extern crate toml;

use std::collections::{BTreeMap, BTreeSet};
use std::collections::btree_map::Entry;
use std::fs::File;
use std::io::{Read, Write};

use cargo::core::{Dependency, Registry, Source, SourceId, Summary};
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
    #[serde(rename="max_version")]
    version: String,
}

/// A Cargo.toml file.
#[derive(Serialize)]
struct TomlManifest {
    package: Package,
    dependencies: BTreeMap<String, String>,
}

/// Header of Cargo.toml file.
#[derive(Serialize)]
struct Package {
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

impl Modifications {
    fn blacklisted(&self, name: &str) -> bool {
        self.blacklist.iter().any(|n| n == name)
    }

    fn additions(&self, existing_names: &[&str]) -> Vec<&str> {
        let existing_names: BTreeSet<_> = existing_names.iter().collect();
        self.additions.iter()
            .map(|n| n.as_str())
            .filter(|n| !existing_names.contains(n))
            .collect()
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
        let added_crates: Vec<_> = {
            let names = self.names();
            let new_names = MODIFICATIONS.additions(&names);

            new_names.into_iter().map(|name| {
                let api_url = format!("https://crates.io/api/v1/crates/{}", name);

                let resp =
                    reqwest::get(&api_url)
                    .unwrap_or_else(|e| panic!("Could not fetch crate {}: {}", name, e));
                assert!(resp.status().is_success());

                let one: OneCrate = serde_json::from_reader(resp)
                    .unwrap_or_else(|e| panic!("Crate {} had invalid JSON: {}", name, e));

                one.krate
            }).collect()
        };

        self.crates.extend(added_crates);
    }

    fn names(&self) -> Vec<&str> {
        self.crates.iter().map(|c| c.name.as_str()).collect()
    }
}

fn decide_features(summary: &Summary) -> Method<'static> {
    lazy_static! {
        static ref PLAYGROUND_FEATURES: Vec<String> = vec!["playground".to_owned()];
    }

    // Enable `playground` feature if present.
    if summary.features().contains_key("playground") {
        Method::Required {
            dev_deps: false,
            features: &*PLAYGROUND_FEATURES,
            uses_default_features: false,
        }
    } else {
        Method::Required {
            dev_deps: false,
            features: &[],
            uses_default_features: true,
        }
    }
}

fn unique_latest_crates(resolve: Resolve) -> BTreeMap<String, String> {
    let mut uniqs = BTreeMap::new();
    for pkg in resolve.iter() {
        if MODIFICATIONS.blacklisted(pkg.name()) {
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
         .map(|(name, version)| (name.to_string(), version.to_string()))
         .collect()
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
    let mut registry = RegistrySource::remote(&crates_io, &config);
    registry.update().expect("Unable to update registry");

    let mut top = TopCrates::download();
    top.add_curated_crates();

    let mut summaries = Vec::new();
    for Crate { ref name, ref version } in top.crates {
        if MODIFICATIONS.blacklisted(name) {
            continue;
        }

        // Query the registry for summary of this crate.
        let dep = Dependency::parse_no_deprecated(name, Some(version), &crates_io)
            .unwrap_or_else(|e| panic!("Unable to parse dependency for {}:{}: {}", name, version, e));

        let matches = registry.query_vec(&dep).unwrap_or_else(|e| {
            panic!("Unable to query registry for {}:{}: {}", name, version, e);
        });
        if matches.len() != 1 {
            panic!("expected one registry match for `{}:{}`", name, version);
        }
        let summary = matches.into_iter().next().unwrap();

        // Add a dependency on this crate.
        let method = decide_features(&summary);
        summaries.push((summary, method));
    }

    // Resolve transitive dependencies.
    let res = resolver::resolve(&summaries, &[], &mut registry, None, true)
        .expect("Unable to resolve dependencies");

    // Construct playground's Cargo.toml.
    let unique_latest_crates = unique_latest_crates(res);
    let manifest = TomlManifest {
        package: Package {
            name: "playground".to_owned(),
            version: "0.0.1".to_owned(),
            authors: vec!["The Rust Playground".to_owned()],
        },
        dependencies: unique_latest_crates.clone(),
    };

    // Write manifest file.
    let cargo_toml = "result.Cargo.toml";
    write_manifest(manifest, cargo_toml);
    println!("wrote {}", cargo_toml);

    let mut infos = Vec::new();

    for (name, version) in unique_latest_crates {
        let pkgid = cargo::core::PackageId::new(&name, &version, &crates_io)
            .unwrap_or_else(|e| panic!("Unable to build PackageId for {} {}: {}", name, version, e));

        let pkg = registry.download(&pkgid)
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
    }

    let path = "crate-information.json";
    let mut f = File::create(path)
        .unwrap_or_else(|e| panic!("Unable to create {}: {}", path, e));
    serde_json::to_writer_pretty(&mut f, &infos)
        .unwrap_or_else(|e| panic!("Unable to write {}: {}", path, e));
    println!("Wrote {}", path);
}
