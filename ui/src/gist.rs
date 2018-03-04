use hubcaps::gists::{self, Content, GistOptions};
use hubcaps::{Credentials, Github};
use std::collections::HashMap;
use tokio_core::reactor::{Core, Handle};
use hyper;
use hyper_tls;

const FILENAME: &str = "playground.rs";
const DESCRIPTION: &str = "Code shared from the Rust Playground";

pub struct Gist {
    pub id: String,
    pub url: String,
    pub code: String,
}

impl From<gists::Gist> for Gist {
    fn from(other: gists::Gist) -> Self {
        let mut files: Vec<_> = other.files
            .into_iter()
            .map(|(name, file)| (name, file.content.unwrap_or_default()))
            .collect();

        files.sort_by(|&(ref name1, _), &(ref name2, _)| name1.cmp(name2));

        let code = match files.len() {
            0 | 1 => files.into_iter().map(|(_, content)| content).collect(),
            _ => {
                files
                    .into_iter()
                    .map(|(name, content)| format!("// ${}\n\n${}\n\n", name, content))
                    .collect()
            }
        };

        Gist {
            id: other.id,
            url: other.html_url,
            code: code,
        }
    }
}

pub fn create(token: String, code: String) -> Gist {
    let mut core = core();
    let github = github(token, &core.handle());

    let file = Content {
        filename: None,
        content: code,
    };

    let mut files = HashMap::new();
    files.insert(FILENAME.into(), file);

    let options = GistOptions {
        description: Some(DESCRIPTION.into()),
        public: Some(true),
        files,
    };

    let creation = github.gists().create(&options);

    // TODO: Better reporting of failures
    let gist = core.run(creation).expect("Unable to create gist");

    gist.into()
}

pub fn load(token: String, id: &str) -> Gist {
    let mut core = core();
    let github = github(token, &core.handle());

    let loading = github.gists().get(id);

    // TODO: Better reporting of a 404
    let gist = core.run(loading).expect("Unable to load gist");

    gist.into()
}

fn core() -> Core {
    Core::new().expect("Unable to create the reactor")
}

type HubcapConnector = hyper_tls::HttpsConnector<hyper::client::HttpConnector>;

fn github(token: String, handle: &Handle) -> Github<HubcapConnector> {
    Github::new(
        String::from("The Rust Playground"),
        Some(Credentials::Token(token)),
        handle,
    )
}
