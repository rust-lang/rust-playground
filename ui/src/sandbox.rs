use serde_derive::Deserialize;
use snafu::prelude::*;
use std::{collections::BTreeMap, fmt, io, string, time::Duration};
use tempfile::TempDir;
use tokio::{process::Command, time};

pub(crate) const DOCKER_PROCESS_TIMEOUT_SOFT: Duration = Duration::from_secs(10);
const DOCKER_PROCESS_TIMEOUT_HARD: Duration = Duration::from_secs(12);

#[derive(Debug, Deserialize)]
struct CrateInformationInner {
    name: String,
    version: String,
    id: String,
}

#[derive(Debug, Clone)]
pub struct CrateInformation {
    pub name: String,
    pub version: String,
    pub id: String,
}

impl From<CrateInformationInner> for CrateInformation {
    fn from(me: CrateInformationInner) -> Self {
        let CrateInformationInner { name, version, id } = me;
        Self { name, version, id }
    }
}

#[derive(Debug, Clone)]
pub struct Version {
    pub release: String,
    pub commit_hash: String,
    pub commit_date: String,
}

#[derive(Debug, Snafu)]
pub enum Error {
    #[snafu(display("Unable to create temporary directory: {}", source))]
    UnableToCreateTempDir { source: io::Error },

    #[snafu(display("Unable to start the compiler: {}", source))]
    UnableToStartCompiler { source: io::Error },
    #[snafu(display("Unable to find the compiler ID"))]
    MissingCompilerId,
    #[snafu(display("Unable to wait for the compiler: {}", source))]
    UnableToWaitForCompiler { source: io::Error },
    #[snafu(display("Unable to get output from the compiler: {}", source))]
    UnableToGetOutputFromCompiler { source: io::Error },
    #[snafu(display("Unable to remove the compiler: {}", source))]
    UnableToRemoveCompiler { source: io::Error },
    #[snafu(display("Compiler execution took longer than {} ms", timeout.as_millis()))]
    CompilerExecutionTimedOut {
        source: tokio::time::error::Elapsed,
        timeout: Duration,
    },

    #[snafu(display("Unable to read crate information: {}", source))]
    UnableToParseCrateInformation { source: ::serde_json::Error },
    #[snafu(display("Output was not valid UTF-8: {}", source))]
    OutputNotUtf8 { source: string::FromUtf8Error },
    #[snafu(display("Release was missing from the version output"))]
    VersionReleaseMissing,
    #[snafu(display("Commit hash was missing from the version output"))]
    VersionHashMissing,
    #[snafu(display("Commit date was missing from the version output"))]
    VersionDateMissing,
}

pub type Result<T, E = Error> = ::std::result::Result<T, E>;

fn vec_to_str(v: Vec<u8>) -> Result<String> {
    String::from_utf8(v).context(OutputNotUtf8Snafu)
}

macro_rules! docker_command {
    ($($arg:expr),* $(,)?) => ({
        let mut cmd = Command::new("docker");
        $( cmd.arg($arg); )*
        cmd
    });
}

fn basic_secure_docker_command() -> Command {
    let mut cmd = docker_command!(
        "run",
        "--platform",
        "linux/amd64",
        "--detach",
        "--cap-drop=ALL",
        // Needed to allow overwriting the file
        "--cap-add=DAC_OVERRIDE",
        "--security-opt=no-new-privileges",
        "--workdir",
        "/playground",
        "--net",
        "none",
        "--memory",
        "512m",
        "--memory-swap",
        "640m",
        "--env",
        format!(
            "PLAYGROUND_TIMEOUT={}",
            DOCKER_PROCESS_TIMEOUT_SOFT.as_secs()
        ),
        "--oom-score-adj",
        "1000",
    );

    if cfg!(feature = "fork-bomb-prevention") {
        cmd.args(&["--pids-limit", "512"]);
    }

    cmd.kill_on_drop(true);

    cmd
}

pub struct Sandbox {
    #[allow(dead_code)]
    scratch: TempDir,
}

impl Sandbox {
    pub async fn new() -> Result<Self> {
        // `TempDir` performs *synchronous* filesystem operations
        // now and when it's dropped. We accept that under the
        // assumption that the specific operations will be quick
        // enough.
        let scratch = tempfile::Builder::new()
            .prefix("playground")
            .tempdir()
            .context(UnableToCreateTempDirSnafu)?;

        Ok(Sandbox { scratch })
    }

    pub async fn crates(&self) -> Result<Vec<CrateInformation>> {
        let mut command = basic_secure_docker_command();
        command.args(&[Channel::Stable.container_name()]);
        command.args(&["cat", "crate-information.json"]);

        let output = run_command_with_timeout(command).await?;

        let crate_info: Vec<CrateInformationInner> =
            ::serde_json::from_slice(&output.stdout).context(UnableToParseCrateInformationSnafu)?;

        let crates = crate_info.into_iter().map(Into::into).collect();

        Ok(crates)
    }

    pub async fn version(&self, channel: Channel) -> Result<Version> {
        let mut command = basic_secure_docker_command();
        command.args(&[channel.container_name()]);
        command.args(&["rustc", "--version", "--verbose"]);

        let output = run_command_with_timeout(command).await?;
        let version_output = vec_to_str(output.stdout)?;

        let mut info: BTreeMap<String, String> = version_output
            .lines()
            .skip(1)
            .filter_map(|line| {
                let mut pieces = line.splitn(2, ':').fuse();
                match (pieces.next(), pieces.next()) {
                    (Some(name), Some(value)) => Some((name.trim().into(), value.trim().into())),
                    _ => None,
                }
            })
            .collect();

        let release = info.remove("release").context(VersionReleaseMissingSnafu)?;
        let commit_hash = info
            .remove("commit-hash")
            .context(VersionHashMissingSnafu)?;
        let commit_date = info
            .remove("commit-date")
            .context(VersionDateMissingSnafu)?;

        Ok(Version {
            release,
            commit_hash,
            commit_date,
        })
    }

    pub async fn version_rustfmt(&self) -> Result<Version> {
        let mut command = basic_secure_docker_command();
        command.args(&["rustfmt", "cargo", "fmt", "--version"]);
        self.cargo_tool_version(command).await
    }

    pub async fn version_clippy(&self) -> Result<Version> {
        let mut command = basic_secure_docker_command();
        command.args(&["clippy", "cargo", "clippy", "--version"]);
        self.cargo_tool_version(command).await
    }

    pub async fn version_miri(&self) -> Result<Version> {
        let mut command = basic_secure_docker_command();
        command.args(&["miri", "cargo", "miri", "--version"]);
        self.cargo_tool_version(command).await
    }

    // Parses versions of the shape `toolname 0.0.0 (0000000 0000-00-00)`
    async fn cargo_tool_version(&self, command: Command) -> Result<Version> {
        let output = run_command_with_timeout(command).await?;
        let version_output = vec_to_str(output.stdout)?;
        let mut parts = version_output.split_whitespace().fuse().skip(1);

        let release = parts.next().unwrap_or("").into();
        let commit_hash = parts.next().unwrap_or("").trim_start_matches('(').into();
        let commit_date = parts.next().unwrap_or("").trim_end_matches(')').into();

        Ok(Version {
            release,
            commit_hash,
            commit_date,
        })
    }
}

async fn run_command_with_timeout(mut command: Command) -> Result<std::process::Output> {
    use std::os::unix::process::ExitStatusExt;

    let timeout = DOCKER_PROCESS_TIMEOUT_HARD;

    let output = command.output().await.context(UnableToStartCompilerSnafu)?;

    // Exit early, in case we don't have the container
    if !output.status.success() {
        return Ok(output);
    }

    let output = String::from_utf8_lossy(&output.stdout);
    let id = output
        .lines()
        .next()
        .context(MissingCompilerIdSnafu)?
        .trim();

    // ----------

    let mut command = docker_command!("wait", id);

    let timed_out = match time::timeout(timeout, command.output()).await {
        Ok(Ok(o)) => {
            // Didn't time out, didn't fail to run
            let o = String::from_utf8_lossy(&o.stdout);
            let code = o
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .parse()
                .unwrap_or(i32::MAX);
            Ok(ExitStatusExt::from_raw(code))
        }
        Ok(e) => return e.context(UnableToWaitForCompilerSnafu), // Failed to run
        Err(e) => Err(e),                                        // Timed out
    };

    // ----------

    let mut command = docker_command!("logs", id);
    let mut output = command
        .output()
        .await
        .context(UnableToGetOutputFromCompilerSnafu)?;

    // ----------

    let mut command = docker_command!(
        "rm", // Kills container if still running
        "--force", id
    );
    command.stdout(std::process::Stdio::null());
    command
        .status()
        .await
        .context(UnableToRemoveCompilerSnafu)?;

    let code = timed_out.context(CompilerExecutionTimedOutSnafu { timeout })?;

    output.status = code;

    Ok(output)
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum AssemblyFlavor {
    Att,
    Intel,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum DemangleAssembly {
    Demangle,
    Mangle,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum ProcessAssembly {
    Filter,
    Raw,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, strum::IntoStaticStr)]
pub enum CompileTarget {
    Assembly(AssemblyFlavor, DemangleAssembly, ProcessAssembly),
    LlvmIr,
    Mir,
    Hir,
    Wasm,
}

impl fmt::Display for CompileTarget {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        use self::CompileTarget::*;

        match *self {
            Assembly(_, _, _) => "assembly".fmt(f),
            LlvmIr => "LLVM IR".fmt(f),
            Mir => "Rust MIR".fmt(f),
            Hir => "Rust HIR".fmt(f),
            Wasm => "WebAssembly".fmt(f),
        }
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, strum::IntoStaticStr)]
pub enum Channel {
    Stable,
    Beta,
    Nightly,
}

impl Channel {
    fn container_name(&self) -> &'static str {
        use self::Channel::*;

        match *self {
            Stable => "rust-stable",
            Beta => "rust-beta",
            Nightly => "rust-nightly",
        }
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, strum::IntoStaticStr)]
pub enum Mode {
    Debug,
    Release,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, strum::IntoStaticStr)]
pub enum Edition {
    Rust2015,
    Rust2018,
    Rust2021, // TODO - add parallel tests for 2021
    Rust2024,
}

impl Edition {
    fn cargo_ident(&self) -> &'static str {
        use self::Edition::*;

        match *self {
            Rust2015 => "2015",
            Rust2018 => "2018",
            Rust2021 => "2021",
            Rust2024 => "2024",
        }
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, strum::IntoStaticStr)]
pub enum CrateType {
    Binary,
    Library(LibraryType),
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, strum::IntoStaticStr)]
pub enum LibraryType {
    Lib,
    Dylib,
    Rlib,
    Staticlib,
    Cdylib,
    ProcMacro,
}

impl LibraryType {
    fn cargo_ident(&self) -> &'static str {
        use self::LibraryType::*;

        match *self {
            Lib => "lib",
            Dylib => "dylib",
            Rlib => "rlib",
            Staticlib => "staticlib",
            Cdylib => "cdylib",
            ProcMacro => "proc-macro",
        }
    }
}

trait DockerCommandExt {
    fn apply_crate_type(&mut self, req: impl CrateTypeRequest);
    fn apply_edition(&mut self, req: impl EditionRequest);
    fn apply_backtrace(&mut self, req: impl BacktraceRequest);
}

impl DockerCommandExt for Command {
    fn apply_crate_type(&mut self, req: impl CrateTypeRequest) {
        if let CrateType::Library(lib) = req.crate_type() {
            self.args(&[
                "--env",
                &format!("PLAYGROUND_CRATE_TYPE={}", lib.cargo_ident()),
            ]);
        }
    }

    fn apply_edition(&mut self, req: impl EditionRequest) {
        if let Some(edition) = req.edition() {
            if edition == Edition::Rust2024 {
                self.args(&["--env", &format!("PLAYGROUND_FEATURE_EDITION2024=true")]);
            }

            self.args(&[
                "--env",
                &format!("PLAYGROUND_EDITION={}", edition.cargo_ident()),
            ]);
        }
    }

    fn apply_backtrace(&mut self, req: impl BacktraceRequest) {
        if req.backtrace() {
            self.args(&["--env", "RUST_BACKTRACE=1"]);
        }
    }
}

trait CrateTypeRequest {
    fn crate_type(&self) -> CrateType;
}

impl<R: CrateTypeRequest> CrateTypeRequest for &'_ R {
    fn crate_type(&self) -> CrateType {
        (*self).crate_type()
    }
}

trait EditionRequest {
    fn edition(&self) -> Option<Edition>;
}

impl<R: EditionRequest> EditionRequest for &'_ R {
    fn edition(&self) -> Option<Edition> {
        (*self).edition()
    }
}

trait BacktraceRequest {
    fn backtrace(&self) -> bool;
}

impl<R: BacktraceRequest> BacktraceRequest for &'_ R {
    fn backtrace(&self) -> bool {
        (*self).backtrace()
    }
}
