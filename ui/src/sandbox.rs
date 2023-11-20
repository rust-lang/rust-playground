use serde_derive::Deserialize;
use snafu::prelude::*;
use std::{
    collections::BTreeMap, fmt, io, os::unix::fs::PermissionsExt, path::PathBuf, string,
    time::Duration,
};
use tempfile::TempDir;
use tokio::{fs, process::Command, time};
use tracing::debug;

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
    #[snafu(display("Unable to create output directory: {}", source))]
    UnableToCreateOutputDir { source: io::Error },
    #[snafu(display("Unable to set permissions for output directory: {}", source))]
    UnableToSetOutputPermissions { source: io::Error },
    #[snafu(display("Unable to create source file: {}", source))]
    UnableToCreateSourceFile { source: io::Error },
    #[snafu(display("Unable to set permissions for source file: {}", source))]
    UnableToSetSourcePermissions { source: io::Error },

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

    #[snafu(display("Unable to read output file: {}", source))]
    UnableToReadOutput { source: io::Error },
    #[snafu(display("Unable to read crate information: {}", source))]
    UnableToParseCrateInformation { source: ::serde_json::Error },
    #[snafu(display("Output was not valid UTF-8: {}", source))]
    OutputNotUtf8 { source: string::FromUtf8Error },
    #[snafu(display("Output was missing"))]
    OutputMissing,
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

// We must create a world-writable files (rustfmt) and directories
// (LLVM IR) so that the process inside the Docker container can write
// into it.
//
// This problem does *not* occur when using the indirection of
// docker-machine.
fn wide_open_permissions() -> std::fs::Permissions {
    PermissionsExt::from_mode(0o777)
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
    input_file: PathBuf,
    output_dir: PathBuf,
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
        let input_file = scratch.path().join("input.rs");
        let output_dir = scratch.path().join("output");

        fs::create_dir(&output_dir)
            .await
            .context(UnableToCreateOutputDirSnafu)?;
        fs::set_permissions(&output_dir, wide_open_permissions())
            .await
            .context(UnableToSetOutputPermissionsSnafu)?;

        Ok(Sandbox {
            scratch,
            input_file,
            output_dir,
        })
    }

    pub async fn miri(&self, req: &MiriRequest) -> Result<MiriResponse> {
        self.write_source_code(&req.code).await?;
        let command = self.miri_command(req);

        let output = run_command_with_timeout(command).await?;

        Ok(MiriResponse {
            success: output.status.success(),
            stdout: vec_to_str(output.stdout)?,
            stderr: vec_to_str(output.stderr)?,
        })
    }

    pub async fn macro_expansion(
        &self,
        req: &MacroExpansionRequest,
    ) -> Result<MacroExpansionResponse> {
        self.write_source_code(&req.code).await?;
        let command = self.macro_expansion_command(req);

        let output = run_command_with_timeout(command).await?;

        Ok(MacroExpansionResponse {
            success: output.status.success(),
            stdout: vec_to_str(output.stdout)?,
            stderr: vec_to_str(output.stderr)?,
        })
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

    async fn write_source_code(&self, code: &str) -> Result<()> {
        fs::write(&self.input_file, code)
            .await
            .context(UnableToCreateSourceFileSnafu)?;
        fs::set_permissions(&self.input_file, wide_open_permissions())
            .await
            .context(UnableToSetSourcePermissionsSnafu)?;

        debug!(
            "Wrote {} bytes of source to {}",
            code.len(),
            self.input_file.display()
        );
        Ok(())
    }

    fn miri_command(&self, req: impl EditionRequest) -> Command {
        let mut cmd = self.docker_command(None);
        cmd.apply_edition(req);

        cmd.arg("miri").args(&["cargo", "miri-playground"]);

        debug!("Miri command is {:?}", cmd);

        cmd
    }

    fn macro_expansion_command(&self, req: impl EditionRequest) -> Command {
        let mut cmd = self.docker_command(None);
        cmd.apply_edition(req);

        cmd.arg(&Channel::Nightly.container_name()).args(&[
            "cargo",
            "rustc",
            "--",
            "-Zunpretty=expanded",
        ]);

        debug!("Macro expansion command is {:?}", cmd);

        cmd
    }

    fn docker_command(&self, crate_type: Option<CrateType>) -> Command {
        let crate_type = crate_type.unwrap_or(CrateType::Binary);

        let mut mount_input_file = self.input_file.as_os_str().to_os_string();
        mount_input_file.push(":");
        mount_input_file.push("/playground/");
        mount_input_file.push(crate_type.file_name());

        let mut mount_output_dir = self.output_dir.as_os_str().to_os_string();
        mount_output_dir.push(":");
        mount_output_dir.push("/playground-result");

        let mut cmd = basic_secure_docker_command();

        cmd.arg("--volume")
            .arg(&mount_input_file)
            .arg("--volume")
            .arg(&mount_output_dir);

        cmd
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

impl CrateType {
    fn file_name(&self) -> &'static str {
        use self::CrateType::*;

        match *self {
            Binary => "src/main.rs",
            Library(_) => "src/lib.rs",
        }
    }
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

#[derive(Debug, Clone)]
pub struct MiriRequest {
    pub code: String,
    pub edition: Option<Edition>,
}

impl EditionRequest for MiriRequest {
    fn edition(&self) -> Option<Edition> {
        self.edition
    }
}

#[derive(Debug, Clone)]
pub struct MiriResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone)]
pub struct MacroExpansionRequest {
    pub code: String,
    pub edition: Option<Edition>,
}

impl EditionRequest for MacroExpansionRequest {
    fn edition(&self) -> Option<Edition> {
        self.edition
    }
}

#[derive(Debug, Clone)]
pub struct MacroExpansionResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

mod sandbox_orchestrator_integration_impls {
    use orchestrator::coordinator;

    impl From<coordinator::CompileTarget> for super::CompileTarget {
        fn from(value: coordinator::CompileTarget) -> Self {
            match value {
                coordinator::CompileTarget::Assembly(a, b, c) => {
                    super::CompileTarget::Assembly(a.into(), b.into(), c.into())
                }
                coordinator::CompileTarget::Hir => super::CompileTarget::Hir,
                coordinator::CompileTarget::LlvmIr => super::CompileTarget::LlvmIr,
                coordinator::CompileTarget::Mir => super::CompileTarget::Mir,
                coordinator::CompileTarget::Wasm => super::CompileTarget::Wasm,
            }
        }
    }

    impl From<coordinator::Mode> for super::Mode {
        fn from(value: coordinator::Mode) -> Self {
            match value {
                coordinator::Mode::Debug => super::Mode::Debug,
                coordinator::Mode::Release => super::Mode::Release,
            }
        }
    }

    impl From<coordinator::Edition> for super::Edition {
        fn from(value: coordinator::Edition) -> Self {
            match value {
                coordinator::Edition::Rust2015 => super::Edition::Rust2015,
                coordinator::Edition::Rust2018 => super::Edition::Rust2018,
                coordinator::Edition::Rust2021 => super::Edition::Rust2021,
                coordinator::Edition::Rust2024 => super::Edition::Rust2024,
            }
        }
    }

    impl From<coordinator::Channel> for super::Channel {
        fn from(value: coordinator::Channel) -> Self {
            match value {
                coordinator::Channel::Stable => super::Channel::Stable,
                coordinator::Channel::Beta => super::Channel::Beta,
                coordinator::Channel::Nightly => super::Channel::Nightly,
            }
        }
    }

    impl From<coordinator::AssemblyFlavor> for super::AssemblyFlavor {
        fn from(value: coordinator::AssemblyFlavor) -> Self {
            match value {
                coordinator::AssemblyFlavor::Att => super::AssemblyFlavor::Att,
                coordinator::AssemblyFlavor::Intel => super::AssemblyFlavor::Intel,
            }
        }
    }

    impl From<coordinator::CrateType> for super::CrateType {
        fn from(value: coordinator::CrateType) -> Self {
            match value {
                coordinator::CrateType::Binary => super::CrateType::Binary,
                coordinator::CrateType::Library(a) => super::CrateType::Library(a.into()),
            }
        }
    }

    impl From<coordinator::DemangleAssembly> for super::DemangleAssembly {
        fn from(value: coordinator::DemangleAssembly) -> Self {
            match value {
                coordinator::DemangleAssembly::Demangle => super::DemangleAssembly::Demangle,
                coordinator::DemangleAssembly::Mangle => super::DemangleAssembly::Mangle,
            }
        }
    }

    impl From<coordinator::ProcessAssembly> for super::ProcessAssembly {
        fn from(value: coordinator::ProcessAssembly) -> Self {
            match value {
                coordinator::ProcessAssembly::Filter => super::ProcessAssembly::Filter,
                coordinator::ProcessAssembly::Raw => super::ProcessAssembly::Raw,
            }
        }
    }

    impl From<coordinator::LibraryType> for super::LibraryType {
        fn from(value: coordinator::LibraryType) -> Self {
            match value {
                coordinator::LibraryType::Lib => super::LibraryType::Lib,
                coordinator::LibraryType::Dylib => super::LibraryType::Dylib,
                coordinator::LibraryType::Rlib => super::LibraryType::Rlib,
                coordinator::LibraryType::Staticlib => super::LibraryType::Staticlib,
                coordinator::LibraryType::Cdylib => super::LibraryType::Cdylib,
                coordinator::LibraryType::ProcMacro => super::LibraryType::ProcMacro,
            }
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    // Running the tests completely in parallel causes spurious
    // failures due to my resource-limited Docker
    // environment. Additionally, we have some tests that *require*
    // that no other Docker processes are running.
    fn one_test_at_a_time() -> impl Drop {
        use lazy_static::lazy_static;
        use std::sync::Mutex;

        lazy_static! {
            static ref DOCKER_SINGLETON: Mutex<()> = Default::default();
        }

        // We can't poison the empty tuple
        DOCKER_SINGLETON.lock().unwrap_or_else(|e| e.into_inner())
    }

    const HELLO_WORLD_CODE: &'static str = r#"
    fn main() {
        println!("Hello, world!");
    }
    "#;

    #[tokio::test]
    async fn interpreting_code() -> Result<()> {
        let _singleton = one_test_at_a_time();
        let code = r#"
        fn main() {
            let mut a: [u8; 0] = [];
            unsafe { *a.get_unchecked_mut(1) = 1; }
        }
        "#;

        let req = MiriRequest {
            code: code.to_string(),
            edition: None,
        };

        let sb = Sandbox::new().await?;
        let resp = sb.miri(&req).await?;

        assert!(
            resp.stderr.contains("Undefined Behavior"),
            "was: {}",
            resp.stderr
        );
        assert!(
            resp.stderr.contains("pointer to 1 byte"),
            "was: {}",
            resp.stderr
        );
        assert!(
            resp.stderr.contains("starting at offset 0"),
            "was: {}",
            resp.stderr
        );
        assert!(
            resp.stderr.contains("is out-of-bounds"),
            "was: {}",
            resp.stderr
        );
        assert!(resp.stderr.contains("has size 0"), "was: {}", resp.stderr);
        Ok(())
    }
}
