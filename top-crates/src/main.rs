extern crate cargo;
extern crate hyper;
extern crate hyper_native_tls;
#[macro_use]
extern crate lazy_static;
extern crate serde_json;
#[macro_use]
extern crate serde_derive;
extern crate toml;

use std::collections::BTreeMap;
use std::collections::btree_map::Entry;
use std::fs::File;
use std::io::Write;

use cargo::core::{Dependency, Registry, Source, SourceId, Summary};
use cargo::core::resolver::{self, Method, Resolve};
use cargo::sources::RegistrySource;
use cargo::util::Config;
use hyper::client::Client;
use hyper::net::HttpsConnector;
use hyper_native_tls::NativeTlsClient;

#[derive(Debug, Deserialize)]
struct TopCrates {
    crates: Vec<Crate>,
}

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

fn get_top_crates() -> TopCrates {
    let ssl = NativeTlsClient::new().expect("Unable to build TLS client");
    let connector = HttpsConnector::new(ssl);
    let client = Client::with_connector(connector);

    let res = client
        .get("https://crates.io/api/v1/crates?page=1&per_page=100&sort=downloads")
        .send()
        .expect("Could not fetch top crates");
    assert_eq!(res.status, hyper::Ok);

    serde_json::from_reader(res).expect("Invalid JSON")
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
        // Skip blacklisted crates.
        if BLACKLIST.contains(&pkg.name()) {
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

static BLACKLIST: &'static [&'static str] = &[
    "libressl-pnacl-sys", // Fails to build
    "pnacl-build-helper", // Fails to build
    "aster", // Not supported on stable
    "quasi", // Not supported on stable
    "quasi_codegen", // Not supported on stable
    "quasi_macros", // Not supported on stable
    "serde_macros", // Apparently deleted
    "openssl", // Ecosystem is fragmented, only pull in via dependencies
    "openssl-sys", // Ecosystem is fragmented, only pull in via dependencies
    "openssl-sys-extras", // Ecosystem is fragmented, only pull in via dependencies
    "openssl-verify", // Ecosystem is fragmented, only pull in via dependencies
    "redox_syscall", // Not supported on stable
];

fn main() {
    // Setup to interact with cargo.
    let config = Config::default().expect("Unable to create default Cargo config");
    let crates_io = SourceId::crates_io(&config).expect("Unable to create crates.io source ID");
    let mut registry = RegistrySource::remote(&crates_io, &config);
    registry.update().expect("Unable to update registry");

    // List top 100 crates by number of downloads on crates.io.
    let top = get_top_crates();

    let mut summaries = Vec::new();
    for Crate { ref name, ref version } in top.crates {
        // Skip blacklisted crates.
        if BLACKLIST.contains(&&name[..]) {
            continue;
        }

        // Query the registry for summary of this crate.
        let dep = Dependency::parse_no_deprecated(name, Some(version), &crates_io)
            .unwrap_or_else(|e| panic!("Unable to parse dependency for {}:{}: {}", name, version, e));

        let matches = registry.query(&dep).unwrap_or_else(|e| {
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
    let res = resolver::resolve(&summaries, &[], &mut registry)
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
