use serde_derive::Deserialize;
use snafu::prelude::*;
use std::{io, time::Duration};
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
}

pub type Result<T, E = Error> = ::std::result::Result<T, E>;

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
