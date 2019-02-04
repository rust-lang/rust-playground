use hubcaps::{
    self,
    gists::{self, Content, GistOptions},
    Credentials, Github,
};
use hyper;
use hyper_tls;
use std::collections::HashMap;
use tokio::{prelude::Future, runtime::current_thread::Runtime};

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

        files.sort_by(|(name1, _), (name2, _)| name1.cmp(name2));

        let code = match files.len() {
            0 | 1 => files.into_iter().map(|(_, content)| content).collect(),
            _ => {
                files
                    .into_iter()
                    .map(|(name, content)| format!("// {}\n\n{}\n\n", name, content))
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
    Runtime::new()
        .expect("unable to create runtime")
        .block_on(create_future(token, code))
        .expect("Unable to create gist")
    // TODO: Better reporting of failures
}

pub fn create_future(token: String, code: String) -> impl Future<Item = Gist, Error = hubcaps::Error> {
    let github = github(token);

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

    github
        .gists()
        .create(&options)
        .map(Into::into)
}

pub fn load(token: String, id: &str) -> Gist {
    Runtime::new()
        .expect("unable to create runtime")
        .block_on(load_future(token, id))
        .expect("Unable to load gist")
    // TODO: Better reporting of a 404
}

pub fn load_future(token: String, id: &str) -> impl Future<Item = Gist, Error = ::hubcaps::Error> {
    let github = github(token);

    github
        .gists()
        .get(id)
        .map(Into::into)
}

type HubcapConnector = hyper_tls::HttpsConnector<hyper::client::HttpConnector>;

fn github(token: String) -> Github<HubcapConnector> {
    Github::new(
        String::from("The Rust Playground"),
        Some(Credentials::Token(token)),
    )
}
