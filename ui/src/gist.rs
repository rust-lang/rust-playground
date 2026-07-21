use octocrab::Octocrab;
use percent_encoding::AsciiSet;
use serde::{Deserialize, Serialize};
use snafu::prelude::*;

const META_FILENAME: &str = "Playground.toml";
const FILENAME: &str = "playground.rs";
const DESCRIPTION: &str = "Code shared from the Rust Playground";

// GitHub doesn't allow slashes in filenames, so we encode them.
const DISALLOWED_FILENAME_CHARS: AsciiSet = AsciiSet::EMPTY.add(b'/');

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "version")]
enum SerializedMeta {
    #[serde(rename = "1")]
    V1,
}

impl From<V1> for SerializedMeta {
    fn from(_: V1) -> Self {
        SerializedMeta::V1
    }
}

enum Meta {
    /// Represents gists created before we added the `Playground.toml`
    /// file, or gists that were created outside of the Playground.
    V0,

    /// Started supporting multiple files and files in a hierarchy.
    V1(V1),
}

impl Meta {
    fn decode_filename(&self, name: String) -> String {
        match self {
            Meta::V0 => name,
            Meta::V1(m) => m.decode_filename(name),
        }
    }
}

struct V1;

impl V1 {
    fn encode_filename(&self, name: String) -> String {
        percent_encoding::utf8_percent_encode(&name, &DISALLOWED_FILENAME_CHARS).to_string()
    }

    fn decode_filename(&self, name: String) -> String {
        percent_encoding::percent_decode_str(&name)
            .decode_utf8_lossy()
            .into_owned()
    }
}

type CurrentMeta = V1;
fn current_meta() -> CurrentMeta {
    V1
}

pub struct Gist {
    pub id: String,
    pub url: String,
    pub code: Code,
}

pub enum Code {
    Single(String),
    Multiple(Vec<CodeFile>),
}

pub struct CodeFile {
    pub name: String,
    pub content: String,
}

fn remove_meta(gist: &mut octocrab::models::gists::Gist) -> Meta {
    let Some(meta) = gist.files.remove(META_FILENAME) else {
        return Meta::V0;
    };

    let Some(content) = &meta.content else {
        return Meta::V0;
    };

    match toml::from_str::<SerializedMeta>(content) {
        Ok(SerializedMeta::V1) => Meta::V1(V1),
        Err(_) => Meta::V0,
    }
}

impl From<octocrab::models::gists::Gist> for Gist {
    fn from(mut other: octocrab::models::gists::Gist) -> Self {
        let meta = remove_meta(&mut other);

        let mut files: Vec<_> = other
            .files
            .into_iter()
            .map(|(name, file)| {
                let name = meta.decode_filename(name);
                let content = file.content.unwrap_or_default();
                CodeFile { name, content }
            })
            .collect();

        let code = match files.len() {
            0 | 1 => Code::Single(files.pop().map(|cf| cf.content).unwrap_or_default()),
            _ => Code::Multiple(files),
        };

        Gist {
            id: other.id,
            url: other.html_url.into(),
            code,
        }
    }
}

pub async fn create_future(token: String, code: Code) -> Result<Gist, CreateError> {
    use create_error::*;

    let meta = current_meta();
    let github = github(token)?;

    let handler = github
        .gists()
        .create()
        .description(DESCRIPTION)
        .public(false);

    let handler = match code {
        Code::Single(code) => handler.file(meta.encode_filename(FILENAME.to_owned()), code),
        Code::Multiple(files) => files.into_iter().fold(handler, |handler, codefile| {
            handler.file(meta.encode_filename(codefile.name), codefile.content)
        }),
    };

    let meta_content =
        toml::to_string_pretty(&SerializedMeta::from(meta)).context(SerializeSnafu)?;
    let handler = handler.file(META_FILENAME, meta_content);

    handler.send().await.map(Into::into).map_err(Into::into)
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum CreateError {
    #[snafu(transparent)]
    Octocrab { source: octocrab::Error },

    #[snafu(display("Unable to serialize playground meta information"))]
    Serialize { source: toml::ser::Error },
}

pub async fn load_future(token: String, id: &str) -> octocrab::Result<Gist> {
    let github = github(token)?;

    github.gists().get(id).await.map(Into::into)
}

fn github(token: String) -> octocrab::Result<Octocrab> {
    octocrab::OctocrabBuilder::new()
        .personal_token(token)
        .build()
}

#[cfg(test)]
mod test {
    use super::*;
    use std::assert_matches;
    use std::error::Error;

    #[test]
    fn serialize_current_meta() -> Result<(), Box<dyn Error>> {
        let meta = current_meta();
        let meta = SerializedMeta::from(meta);
        let serialized = toml::to_string_pretty(&meta)?;
        assert_eq!(r#"version = "1""#, serialized.trim());
        Ok(())
    }

    #[test]
    fn deserialize_meta_v1() -> Result<(), Box<dyn Error>> {
        let meta: SerializedMeta = toml::from_str(r#"version = "1""#)?;
        assert_matches!(meta, SerializedMeta::V1);
        Ok(())
    }
}
