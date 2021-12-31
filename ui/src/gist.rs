use hubcaps::{
    self,
    gists::{self, Content, GistOptions},
    Credentials, Github,
};
use std::collections::HashMap;

const FILENAME: &str = "playground.rs";
const DESCRIPTION: &str = "Code shared from the Rust Playground";

pub struct Gist {
    pub id: String,
    pub url: String,
    pub code: String,
}

impl From<gists::Gist> for Gist {
    fn from(other: gists::Gist) -> Self {
        let mut files: Vec<_> = other
            .files
            .into_iter()
            .map(|(name, file)| (name, file.content.unwrap_or_default()))
            .collect();

        files.sort_by(|(name1, _), (name2, _)| name1.cmp(name2));

        let code = match files.len() {
            0 | 1 => files.into_iter().map(|(_, content)| content).collect(),
            _ => files
                .into_iter()
                .map(|(name, content)| format!("// {}\n{}\n\n", name, content))
                .collect(),
        };

        Gist {
            id: other.id,
            url: other.html_url,
            code: code,
        }
    }
}

#[tokio::main]
pub async fn create(token: String, code: String) -> Gist {
    create_future(token, code)
        .await
        .expect("Unable to create gist")
    // TODO: Better reporting of failures
}

pub async fn create_future(token: String, code: String) -> hubcaps::Result<Gist> {
    let github = github(token)?;

    let file = Content {
        filename: None,
        content: code,
    };

    let mut files = HashMap::new();
    files.insert(FILENAME.into(), file);

    let options = GistOptions {
        description: Some(DESCRIPTION.into()),
        public: Some(false),
        files,
    };

    github.gists().create(&options).await.map(Into::into)
}

#[tokio::main]
pub async fn load(token: String, id: &str) -> Gist {
    load_future(token, id).await.expect("Unable to load gist")
    // TODO: Better reporting of a 404
}

pub async fn load_future(token: String, id: &str) -> hubcaps::Result<Gist> {
    let github = github(token)?;

    github.gists().get(id).await.map(Into::into)
}

fn github(token: String) -> hubcaps::Result<Github> {
    Github::new("The Rust Playground", Credentials::Token(token))
}
