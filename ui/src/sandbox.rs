use serde_derive::Deserialize;
use snafu::{ResultExt, Snafu};
use std::{
    collections::BTreeMap,
    ffi::OsStr,
    fmt,
    fs::{self, File},
    io::{self, prelude::*, BufReader, ErrorKind},
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
    string,
    time::Duration,
};
use tempdir::TempDir;
use tokio::process::Command;

const DOCKER_PROCESS_TIMEOUT_SOFT: Duration = Duration::from_secs(10);
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
    #[snafu(display("Unable to execute the compiler: {}", source))]
    UnableToExecuteCompiler { source: io::Error },
    #[snafu(display("Compiler execution took longer than {} ms", timeout.as_millis()))]
    CompilerExecutionTimedOut { source: tokio::time::Elapsed, timeout: Duration },
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

pub struct Sandbox {
    #[allow(dead_code)]
    scratch: TempDir,
    input_file: PathBuf,
    rustfmt_toml: PathBuf,
    output_dir: PathBuf,
}

fn vec_to_str(v: Vec<u8>) -> Result<String> {
    String::from_utf8(v).context(OutputNotUtf8)
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

impl Sandbox {
    pub fn new() -> Result<Self> {
        let scratch = TempDir::new("playground").context(UnableToCreateTempDir)?;
        let input_file = scratch.path().join("input.rs");
        let rustfmt_toml = scratch.path().join("rustfmt.toml");
        let output_dir = scratch.path().join("output");

        fs::create_dir(&output_dir).context(UnableToCreateOutputDir)?;
        fs::set_permissions(&output_dir, wide_open_permissions()).context(UnableToSetOutputPermissions)?;

        Ok(Sandbox {
            scratch,
            input_file,
            rustfmt_toml,
            output_dir,
        })
    }

    pub fn compile(&self, req: &CompileRequest) -> Result<CompileResponse> {
        self.write_source_code(&req.code)?;

        let command = self.compile_command(req.target, req.channel, req.mode, req.tests, req);

        let output = run_command_with_timeout(command)?;

        // The compiler writes the file to a name like
        // `compilation-3b75174cac3d47fb.ll`, so we just find the
        // first with the right extension.
        let file =
            fs::read_dir(&self.output_dir)
            .context(UnableToReadOutput)?
            .flat_map(|entry| entry)
            .map(|entry| entry.path())
            .find(|path| path.extension() == Some(req.target.extension()));

        let stdout = vec_to_str(output.stdout)?;
        let mut stderr = vec_to_str(output.stderr)?;

        let mut code = match file {
            Some(file) => read(&file)?.unwrap_or_else(String::new),
            None => {
                // If we didn't find the file, it's *most* likely that
                // the user's code was invalid. Tack on our own error
                // to the compiler's error instead of failing the
                // request.
                use self::fmt::Write;
                write!(&mut stderr, "\nUnable to locate file for {} output", req.target)
                    .expect("Unable to write to a string");
                String::new()
            }
        };

        if let CompileTarget::Assembly(_, demangle, process) = req.target {

            if demangle == DemangleAssembly::Demangle {
                code = super::asm_cleanup::demangle_asm(&code);
            }

            if process == ProcessAssembly::Filter {
                code = super::asm_cleanup::filter_asm(&code);
            }
        }

        Ok(CompileResponse {
            success: output.status.success(),
            code,
            stdout,
            stderr,
        })
    }

    pub fn execute(&self, req: &ExecuteRequest) -> Result<ExecuteResponse> {
        self.write_source_code(&req.code)?;
        let command = self.execute_command(req.channel, req.mode, req.tests, req);

        let output = run_command_with_timeout(command)?;

        Ok(ExecuteResponse {
            success: output.status.success(),
            stdout: vec_to_str(output.stdout)?,
            stderr: vec_to_str(output.stderr)?,
        })
    }

    pub fn format(&self, req: &FormatRequest) -> Result<FormatResponse> {
        self.write_source_code(&req.code)?;
        self.write_rustfmt_toml(&req.rustfmt_toml)?;
        let command = self.format_command(req);

        let output = run_command_with_timeout(command)?;

        Ok(FormatResponse {
            success: output.status.success(),
            code: read(self.input_file.as_ref())?.ok_or(Error::OutputMissing)?,
            stdout: vec_to_str(output.stdout)?,
            stderr: vec_to_str(output.stderr)?,
        })
    }

    pub fn clippy(&self, req: &ClippyRequest) -> Result<ClippyResponse> {
        self.write_source_code(&req.code)?;
        let command = self.clippy_command(req);

        let output = run_command_with_timeout(command)?;

        Ok(ClippyResponse {
            success: output.status.success(),
            stdout: vec_to_str(output.stdout)?,
            stderr: vec_to_str(output.stderr)?,
        })
    }

    pub fn miri(&self, req: &MiriRequest) -> Result<MiriResponse> {
        self.write_source_code(&req.code)?;
        let command = self.miri_command(req);

        let output = run_command_with_timeout(command)?;

        Ok(MiriResponse {
            success: output.status.success(),
            stdout: vec_to_str(output.stdout)?,
            stderr: vec_to_str(output.stderr)?,
        })
    }

    pub fn crates(&self) -> Result<Vec<CrateInformation>> {
        let mut command = basic_secure_docker_command();
        command.args(&[Channel::Stable.container_name()]);
        command.args(&["cat", "crate-information.json"]);

        let output = run_command_with_timeout(command)?;

        let crate_info: Vec<CrateInformationInner> = ::serde_json::from_slice(&output.stdout).context(UnableToParseCrateInformation)?;

        let crates = crate_info.into_iter()
            .map(Into::into)
            .collect();

        Ok(crates)
    }

    pub fn version(&self, channel: Channel) -> Result<Version> {
        let mut command = basic_secure_docker_command();
        command.args(&[channel.container_name()]);
        command.args(&["rustc", "--version", "--verbose"]);

        let output = run_command_with_timeout(command)?;
        let version_output = vec_to_str(output.stdout)?;

        let mut info: BTreeMap<String, String> = version_output.lines().skip(1).filter_map(|line| {
            let mut pieces = line.splitn(2, ':').fuse();
            match (pieces.next(), pieces.next()) {
                (Some(name), Some(value)) => Some((name.trim().into(), value.trim().into())),
                _ => None
            }
        }).collect();

        let release = info.remove("release").ok_or(Error::VersionReleaseMissing)?;
        let commit_hash = info.remove("commit-hash").ok_or(Error::VersionHashMissing)?;
        let commit_date = info.remove("commit-date").ok_or(Error::VersionDateMissing)?;

        Ok(Version { release, commit_hash, commit_date })
    }


    pub fn version_rustfmt(&self) -> Result<Version> {
        let mut command = basic_secure_docker_command();
        command.args(&["rustfmt", "cargo", "fmt", "--version"]);
        self.cargo_tool_version(command)
    }

    pub fn version_clippy(&self) -> Result<Version> {
        let mut command = basic_secure_docker_command();
        command.args(&["clippy", "cargo", "clippy", "--version"]);
        self.cargo_tool_version(command)
    }

    pub fn version_miri(&self) -> Result<Version> {
        let mut command = basic_secure_docker_command();
        command.args(&["miri", "cargo", "miri", "--version"]);
        self.cargo_tool_version(command)
    }

    // Parses versions of the shape `toolname 0.0.0 (0000000 0000-00-00)`
    fn cargo_tool_version(&self, command: Command) -> Result<Version> {
        let output = run_command_with_timeout(command)?;
        let version_output = vec_to_str(output.stdout)?;
        let mut parts = version_output.split_whitespace().fuse().skip(1);

        let release = parts.next().unwrap_or("").into();
        let commit_hash = parts.next().unwrap_or("").trim_start_matches('(').into();
        let commit_date = parts.next().unwrap_or("").trim_end_matches(')').into();

        Ok(Version { release, commit_hash, commit_date })
    }

    fn write_source_code(&self, code: &str) -> Result<()> {
        fs::write(&self.input_file, code).context(UnableToCreateSourceFile)?;
        fs::set_permissions(&self.input_file, wide_open_permissions()).context(UnableToSetSourcePermissions)?;

        log::debug!("Wrote {} bytes of source to {}", code.len(), self.input_file.display());
        Ok(())
    }

    fn write_rustfmt_toml(&self, code: &str) -> Result<()> {
      fs::write(&self.rustfmt_toml, code).context(UnableToCreateSourceFile)?;
      fs::set_permissions(&self.rustfmt_toml, wide_open_permissions()).context(UnableToSetSourcePermissions)?;

      log::debug!("Wrote {} bytes of source to rustfmt.toml", code.len());
      Ok(())
  }

    fn compile_command(&self, target: CompileTarget, channel: Channel, mode: Mode, tests: bool, req: impl CrateTypeRequest + EditionRequest + BacktraceRequest) -> Command {
        let mut cmd = self.docker_command(Some(req.crate_type()));
        set_execution_environment(&mut cmd, Some(target), &req);

        let execution_cmd = build_execution_command(Some(target), channel, mode, &req, tests);

        cmd.arg(&channel.container_name()).args(&execution_cmd);

        log::debug!("Compilation command is {:?}", cmd);

        cmd
    }

    fn execute_command(&self, channel: Channel, mode: Mode, tests: bool, req: impl CrateTypeRequest + EditionRequest + BacktraceRequest) -> Command {
        let mut cmd = self.docker_command(Some(req.crate_type()));
        set_execution_environment(&mut cmd, None, &req);

        let execution_cmd = build_execution_command(None, channel, mode, &req, tests);

        cmd.arg(&channel.container_name()).args(&execution_cmd);

        log::debug!("Execution command is {:?}", cmd);

        cmd
    }

    fn format_command(&self, req: impl EditionRequest) -> Command {
        let crate_type = CrateType::Binary;

        let mut cmd = self.docker_command(Some(crate_type));

        cmd.apply_edition(req);

        cmd.arg("rustfmt").args(&["cargo", "fmt"]);

        log::debug!("Formatting command is {:?}", cmd);

        cmd
    }

    fn clippy_command(&self, req: impl CrateTypeRequest + EditionRequest) -> Command {
        let mut cmd = self.docker_command(Some(req.crate_type()));

        cmd.apply_crate_type(&req);
        cmd.apply_edition(&req);

        cmd.arg("clippy").args(&["cargo", "clippy"]);

        log::debug!("Clippy command is {:?}", cmd);

        cmd
    }

    fn miri_command(&self, req: impl EditionRequest) -> Command {
        let mut cmd = self.docker_command(None);
        cmd.apply_edition(req);

        cmd.arg("miri").args(&["cargo", "miri-playground"]);

        log::debug!("Miri command is {:?}", cmd);

        cmd
    }

    fn docker_command(&self, crate_type: Option<CrateType>) -> Command {
        let crate_type = crate_type.unwrap_or(CrateType::Binary);

        let mut mount_input_file = self.input_file.as_os_str().to_os_string();
        mount_input_file.push(":");
        mount_input_file.push("/playground/");
        mount_input_file.push(crate_type.file_name());

        let mut mount_rustfmt = self.rustfmt_toml.as_os_str().to_os_string();
        mount_rustfmt.push(":");
        mount_rustfmt.push("/playground/rustfmt.toml");

        let mut mount_output_dir = self.output_dir.as_os_str().to_os_string();
        mount_output_dir.push(":");
        mount_output_dir.push("/playground-result");

        let mut cmd = basic_secure_docker_command();

        cmd
            .arg("--volume").arg(&mount_input_file)
            .arg("--volume").arg(&mount_rustfmt)
            .arg("--volume").arg(&mount_output_dir);

        cmd
    }
}

fn basic_secure_docker_command() -> Command {
    let mut cmd = Command::new("docker");

    cmd
        .arg("run")
        .arg("--rm")
        .arg("--cap-drop=ALL")
        // Needed to allow overwriting the file
        .arg("--cap-add=DAC_OVERRIDE")
        .arg("--security-opt=no-new-privileges")
        .args(&["--workdir", "/playground"])
        .args(&["--net", "none"])
        .args(&["--memory", "256m"])
        .args(&["--memory-swap", "320m"])
        .args(&["--env", &format!("PLAYGROUND_TIMEOUT={}", DOCKER_PROCESS_TIMEOUT_SOFT.as_secs())]);

    if cfg!(feature = "fork-bomb-prevention") {
        cmd.args(&["--pids-limit", "512"]);
    }

    cmd.kill_on_drop(true);

    cmd
}

fn build_execution_command(target: Option<CompileTarget>, channel: Channel, mode: Mode, req: impl CrateTypeRequest, tests: bool) -> Vec<&'static str> {
    use self::CompileTarget::*;
    use self::CrateType::*;
    use self::Mode::*;

    let mut cmd = vec!["cargo"];

    match (target, req.crate_type(), tests) {
        (Some(Wasm), _, _) => cmd.push("wasm"),
        (Some(_), _, _)    => cmd.push("rustc"),
        (_, _, true)       => cmd.push("test"),
        (_, Library(_), _) => cmd.push("build"),
        (_, _, _)          => cmd.push("run"),
    }

    if mode == Release {
        cmd.push("--release");
    }

    if let Some(target) = target {
        cmd.extend(&["--", "-o", "/playground-result/compilation"]);

        match target {
            Assembly(flavor, _, _) => {
                use self::AssemblyFlavor::*;

                cmd.push("--emit=asm");

                // Enable extra assembly comments for nightly builds
                if let Channel::Nightly = channel {
                    cmd.push("-Z");
                    cmd.push("asm-comments");
                }

                cmd.push("-C");
                match flavor {
                    Att => cmd.push("llvm-args=-x86-asm-syntax=att"),
                    Intel => cmd.push("llvm-args=-x86-asm-syntax=intel"),
                }
            },
            LlvmIr => cmd.push("--emit=llvm-ir"),
            Mir => cmd.push("--emit=mir"),
            Wasm => { /* handled by cargo-wasm wrapper */ },
         }
    }

    cmd
}

fn set_execution_environment(cmd: &mut Command, target: Option<CompileTarget>, req: impl CrateTypeRequest + EditionRequest + BacktraceRequest) {
    use self::CompileTarget::*;

    if let Some(Wasm) = target {
        cmd.args(&["--env", "PLAYGROUND_NO_DEPENDENCIES=true"]);
        cmd.args(&["--env", "PLAYGROUND_RELEASE_LTO=true"]);
    }

    cmd.apply_crate_type(&req);
    cmd.apply_edition(&req);
    cmd.apply_backtrace(&req);
}

fn read(path: &Path) -> Result<Option<String>> {
    let f = match File::open(path) {
        Ok(f) => f,
        Err(ref e) if e.kind() == ErrorKind::NotFound => return Ok(None),
        e => e.context(UnableToReadOutput)?,
    };
    let mut f = BufReader::new(f);

    let mut s = String::new();
    f.read_to_string(&mut s).context(UnableToReadOutput)?;
    Ok(Some(s))
}

#[tokio::main]
async fn run_command_with_timeout(mut command: Command) -> Result<std::process::Output> {
    let timeout = DOCKER_PROCESS_TIMEOUT_HARD;

    tokio::time::timeout(timeout, command.output())
        .await
        .context(CompilerExecutionTimedOut { timeout })?
        .context(UnableToExecuteCompiler)
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
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum CompileTarget {
    Assembly(AssemblyFlavor, DemangleAssembly, ProcessAssembly),
    LlvmIr,
    Mir,
    Wasm,
}

impl CompileTarget {
    fn extension(&self) -> &'static OsStr {
        let ext = match *self {
            CompileTarget::Assembly(_, _, _) => "s",
            CompileTarget::LlvmIr            => "ll",
            CompileTarget::Mir               => "mir",
            CompileTarget::Wasm              => "wat",
        };
        OsStr::new(ext)
    }
}

impl fmt::Display for CompileTarget {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        use self::CompileTarget::*;

        match *self {
            Assembly(_, _, _) => "assembly".fmt(f),
            LlvmIr            => "LLVM IR".fmt(f),
            Mir               => "Rust MIR".fmt(f),
            Wasm              => "WebAssembly".fmt(f),
        }
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
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

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum Mode {
    Debug,
    Release,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum Edition {
    Rust2015,
    Rust2018,
}

impl Edition {
    fn cargo_ident(&self) -> &'static str {
        use self::Edition::*;

        match *self {
            Rust2015 => "2015",
            Rust2018 => "2018",
        }
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
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

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum LibraryType {
    Lib,
    Dylib,
    Rlib,
    Staticlib,
    Cdylib,
    ProcMacro
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
            self.args(&["--env", &format!("PLAYGROUND_CRATE_TYPE={}", lib.cargo_ident())]);
        }
    }

    fn apply_edition(&mut self, req: impl EditionRequest) {
        if let Some(edition) = req.edition() {
            self.args(&["--env", &format!("PLAYGROUND_EDITION={}", edition.cargo_ident())]);
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
    fn crate_type(&self) -> CrateType { (*self).crate_type() }
}

trait EditionRequest {
    fn edition(&self) -> Option<Edition>;
}

impl<R: EditionRequest> EditionRequest for &'_ R {
    fn edition(&self) -> Option<Edition> { (*self).edition() }
}

trait BacktraceRequest {
    fn backtrace(&self) -> bool;
}

impl<R: BacktraceRequest> BacktraceRequest for &'_ R {
    fn backtrace(&self) -> bool { (*self).backtrace() }
}

#[derive(Debug, Clone)]
pub struct CompileRequest {
    pub target: CompileTarget,
    pub channel: Channel,
    pub crate_type: CrateType,
    pub mode: Mode,
    pub edition: Option<Edition>,
    pub tests: bool,
    pub backtrace: bool,
    pub code: String,
}

impl CrateTypeRequest for CompileRequest {
    fn crate_type(&self) -> CrateType { self.crate_type }
}

impl EditionRequest for CompileRequest {
    fn edition(&self) -> Option<Edition> { self.edition }
}

impl BacktraceRequest for CompileRequest {
    fn backtrace(&self) -> bool { self.backtrace }
}

#[derive(Debug, Clone)]
pub struct CompileResponse {
    pub success: bool,
    pub code: String,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone)]
pub struct ExecuteRequest {
    pub channel: Channel,
    pub mode: Mode,
    pub edition: Option<Edition>,
    pub crate_type: CrateType,
    pub tests: bool,
    pub backtrace: bool,
    pub code: String,
}

impl CrateTypeRequest for ExecuteRequest {
    fn crate_type(&self) -> CrateType { self.crate_type }
}

impl EditionRequest for ExecuteRequest {
    fn edition(&self) -> Option<Edition> { self.edition }
}

impl BacktraceRequest for ExecuteRequest {
    fn backtrace(&self) -> bool { self.backtrace }
}

#[derive(Debug, Clone)]
pub struct ExecuteResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone)]
pub struct FormatRequest {
    pub code: String,
    pub rustfmt_toml: String,
    pub edition: Option<Edition>,
}

impl EditionRequest for FormatRequest {
    fn edition(&self) -> Option<Edition> { self.edition }
}

#[derive(Debug, Clone)]
pub struct FormatResponse {
    pub success: bool,
    pub code: String,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone)]
pub struct ClippyRequest {
    pub code: String,
    pub edition: Option<Edition>,
    pub crate_type: CrateType,
}

impl CrateTypeRequest for ClippyRequest {
    fn crate_type(&self) -> CrateType { self.crate_type }
}

impl EditionRequest for ClippyRequest {
    fn edition(&self) -> Option<Edition> { self.edition }
}

#[derive(Debug, Clone)]
pub struct ClippyResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone)]
pub struct MiriRequest {
    pub code: String,
    pub edition: Option<Edition>,
}

impl EditionRequest for MiriRequest {
    fn edition(&self) -> Option<Edition> { self.edition }
}

#[derive(Debug, Clone)]
pub struct MiriResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
}

#[cfg(test)]
mod test {
    use super::*;

    const HELLO_WORLD_CODE: &'static str = r#"
    fn main() {
        println!("Hello, world!");
    }
    "#;

    impl Default for ExecuteRequest {
        fn default() -> Self {
            ExecuteRequest {
                channel: Channel::Stable,
                crate_type: CrateType::Binary,
                mode: Mode::Debug,
                tests: false,
                code: HELLO_WORLD_CODE.to_string(),
                edition: None,
                backtrace: false,
            }
        }
    }

    impl Default for CompileRequest {
        fn default() -> Self {
            CompileRequest {
                target: CompileTarget::LlvmIr,
                channel: Channel::Stable,
                crate_type: CrateType::Binary,
                mode: Mode::Debug,
                tests: false,
                code: HELLO_WORLD_CODE.to_string(),
                edition: None,
                backtrace: false,
            }
        }
    }

    impl Default for ClippyRequest {
        fn default() -> Self {
            ClippyRequest {
                code: HELLO_WORLD_CODE.to_string(),
                crate_type: CrateType::Binary,
                edition: None,
            }
        }
    }

    #[test]
    fn basic_functionality() {
        let req = ExecuteRequest::default();

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("Hello, world!"));
    }

    const COMPILATION_MODE_CODE: &'static str = r#"
    #[cfg(debug_assertions)]
    fn main() {
        println!("Compiling in debug mode");
    }

    #[cfg(not(debug_assertions))]
    fn main() {
        println!("Compiling in release mode");
    }
    "#;

    #[test]
    fn debug_mode() {
        let req = ExecuteRequest {
            code: COMPILATION_MODE_CODE.to_string(),
            ..ExecuteRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("debug mode"));
    }

    #[test]
    fn release_mode() {
        let req = ExecuteRequest {
            mode: Mode::Release,
            code: COMPILATION_MODE_CODE.to_string(),
            ..ExecuteRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("release mode"));
    }

    static VERSION_CODE: &'static str = r#"
    use std::process::Command;

    fn main() {
        let output = Command::new("rustc").arg("--version").output().unwrap();
        let output = String::from_utf8(output.stdout).unwrap();
        println!("{}", output);
    }
    "#;

    #[test]
    fn stable_channel() {
        let req = ExecuteRequest {
            channel: Channel::Stable,
            code: VERSION_CODE.to_string(),
            ..ExecuteRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("rustc"));
        assert!(!resp.stdout.contains("beta"));
        assert!(!resp.stdout.contains("nightly"));
    }

    #[test]
    fn beta_channel() {
        let req = ExecuteRequest {
            channel: Channel::Beta,
            code: VERSION_CODE.to_string(),
            ..ExecuteRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("rustc"));
        assert!(resp.stdout.contains("beta"));
        assert!(!resp.stdout.contains("nightly"));
    }

    #[test]
    fn nightly_channel() {
        let req = ExecuteRequest {
            channel: Channel::Nightly,
            code: VERSION_CODE.to_string(),
            ..ExecuteRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("rustc"));
        assert!(!resp.stdout.contains("beta"));
        assert!(resp.stdout.contains("nightly"));
    }

    // Code that will only work in Rust 2015
    const EDITION_CODE: &str = r#"
    fn main() {
        let async = true;
    }
    "#;

    const EDITION_ERROR: &str = "found keyword `async`";

    #[test]
    fn rust_edition_default() -> Result<()> {
        let req = ExecuteRequest {
            channel: Channel::Nightly,
            code: EDITION_CODE.to_string(),
            ..ExecuteRequest::default()
        };

        let resp = Sandbox::new()?.execute(&req)?;

        assert!(!resp.stderr.contains(EDITION_ERROR), "was: {}", resp.stderr);
        Ok(())
    }

    #[test]
    fn rust_edition_2015() -> Result<()> {
        let req = ExecuteRequest {
            channel: Channel::Nightly,
            code: EDITION_CODE.to_string(),
            edition: Some(Edition::Rust2015),
            ..ExecuteRequest::default()
        };

        let resp = Sandbox::new()?.execute(&req)?;

        assert!(!resp.stderr.contains(EDITION_ERROR), "was: {}", resp.stderr);
        Ok(())
    }

    #[test]
    fn rust_edition_2018() -> Result<()> {
        let req = ExecuteRequest {
            channel: Channel::Nightly,
            code: EDITION_CODE.to_string(),
            edition: Some(Edition::Rust2018),
            ..ExecuteRequest::default()
        };

        let resp = Sandbox::new()?.execute(&req)?;

        assert!(resp.stderr.contains(EDITION_ERROR), "was: {}", resp.stderr);
        Ok(())
    }

    const BACKTRACE_CODE: &str = r#"
    fn trigger_the_problem() {
        None::<u8>.unwrap();
    }

    fn main() {
        trigger_the_problem()
    }
    "#;

    const BACKTRACE_NOTE: &str = "run with `RUST_BACKTRACE=1` environment variable to display a backtrace";

    #[test]
    fn backtrace_disabled() -> Result<()> {
        let req = ExecuteRequest {
            code: BACKTRACE_CODE.to_string(),
            backtrace: false,
            ..ExecuteRequest::default()
        };

        let sb = Sandbox::new()?;
        let resp = sb.execute(&req)?;

        assert!(resp.stderr.contains(BACKTRACE_NOTE), "Was: {}", resp.stderr);
        assert!(!resp.stderr.contains("stack backtrace:"), "Was: {}", resp.stderr);

        Ok(())
    }

    #[test]
    fn backtrace_enabled() -> Result<()> {
        let req = ExecuteRequest {
            code: BACKTRACE_CODE.to_string(),
            backtrace: true,
            ..ExecuteRequest::default()
        };

        let sb = Sandbox::new()?;
        let resp = sb.execute(&req)?;

        assert!(!resp.stderr.contains(BACKTRACE_NOTE), "Was: {}", resp.stderr);
        assert!(resp.stderr.contains("stack backtrace:"), "Was: {}", resp.stderr);

        Ok(())
    }

    #[test]
    fn output_llvm_ir() {
        let req = CompileRequest {
            target: CompileTarget::LlvmIr,
            ..CompileRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.compile(&req).expect("Unable to compile code");

        assert!(resp.code.contains("ModuleID"));
        assert!(resp.code.contains("target datalayout"));
        assert!(resp.code.contains("target triple"));
    }

    #[test]
    fn output_assembly() {
        let req = CompileRequest {
            target: CompileTarget::Assembly(AssemblyFlavor::Att, DemangleAssembly::Mangle, ProcessAssembly::Raw),
            ..CompileRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.compile(&req).expect("Unable to compile code");

        assert!(resp.code.contains(".text"));
        assert!(resp.code.contains(".file"));
        assert!(resp.code.contains(".section"));
        assert!(resp.code.contains(".p2align"));
    }

    #[test]
    fn output_demangled_assembly() {
        let req = CompileRequest {
            target: CompileTarget::Assembly(AssemblyFlavor::Att, DemangleAssembly::Demangle, ProcessAssembly::Raw),
            ..CompileRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.compile(&req).expect("Unable to compile code");

        assert!(resp.code.contains("core::fmt::Arguments::new_v1"));
        assert!(resp.code.contains("std::io::stdio::_print@GOTPCREL"));
    }

    #[test]
    #[should_panic]
    fn output_filtered_assembly() {
        let req = CompileRequest {
            target: CompileTarget::Assembly(AssemblyFlavor::Att, DemangleAssembly::Mangle, ProcessAssembly::Filter),
            ..CompileRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.compile(&req).expect("Unable to compile code");

        assert!(resp.code.contains(".text"));
        assert!(resp.code.contains(".file"));
    }

    #[test]
    fn formatting_code() {
        let req = FormatRequest {
            code: "fn foo () { method_call(); }".to_string(),
            rustfmt_toml: "".to_string(),
            edition: None,
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.format(&req).expect("Unable to format code");

        let lines: Vec<_> = resp.code.lines().collect();

        assert_eq!(lines[0], "fn foo() {");
        assert_eq!(lines[1], "    method_call();");
        assert_eq!(lines[2], "}");
    }

    // Code that is only syntactically valid in Rust 2018
    const FORMAT_IN_EDITION_2018: &str = r#"fn main() { use std::num::ParseIntError; let result: Result<i32, ParseIntError> = try { "1".parse::<i32>()? + "2".parse::<i32>()? + "3".parse::<i32>()? }; assert_eq!(result, Ok(6)); }"#;
    const FORMAT_USING_RUSTFMT_TOML: &str = r#"fn main() {
    let lorem = vec![
        "ipsum",
        "dolor",
        "sit",
        "amet",
        "consectetur",
        "adipiscing",
        "elit",
    ];
}
  "#;
    const FORMAT_ERROR: &str = r#"error: expected identifier, found `"1"`"#;

    #[test]
    fn formatting_code_edition_2015() -> Result<()> {
        let req = FormatRequest {
            code: FORMAT_IN_EDITION_2018.to_string(),
            rustfmt_toml: "".to_string(),
            edition: Some(Edition::Rust2015),
        };

        let resp = Sandbox::new()?.format(&req)?;

        assert!(resp.stderr.contains(FORMAT_ERROR));
        Ok(())
    }

    #[test]
    fn formatting_code_edition_2018() -> Result<()> {
        let req = FormatRequest {
            code: FORMAT_IN_EDITION_2018.to_string(),
            rustfmt_toml: "".to_string(),
            edition: Some(Edition::Rust2018),
        };

        let resp = Sandbox::new()?.format(&req)?;
        assert!(!resp.stderr.contains(FORMAT_ERROR));

        let lines: Vec<_> = resp.code.lines().collect();
        assert_eq!(lines[0], r#"fn main() {"#);
        assert_eq!(lines[1], r#"    use std::num::ParseIntError;"#);
        assert_eq!(lines[2], r#"    let result: Result<i32, ParseIntError> ="#);
        assert_eq!(lines[3], r#"        try { "1".parse::<i32>()? + "2".parse::<i32>()? + "3".parse::<i32>()? };"#);
        assert_eq!(lines[4], r#"    assert_eq!(result, Ok(6));"#);
        assert_eq!(lines[5], r#"}"#);
        Ok(())
    }

    #[test]
    fn formatting_code_using_rustfmt_toml() -> Result<()> {
        let req = FormatRequest {
            code: FORMAT_USING_RUSTFMT_TOML.to_string(),
            rustfmt_toml: r#"indent_style = "Visual""#.to_string(),
            edition: Some(Edition::Rust2018),
        };

        let resp = Sandbox::new()?.format(&req)?;
        assert!(!resp.stderr.contains(FORMAT_ERROR));

        let lines: Vec<_> = resp.code.lines().collect();
        assert_eq!(lines[0], r#"fn main() {"#);
        assert_eq!(lines[1], r#"    let lorem = vec!["ipsum","#);
        assert_eq!(lines[2], r#"                     "dolor","#);
        assert_eq!(lines[3], r#"                     "sit","#);
        assert_eq!(lines[4], r#"                     "amet","#);
        assert_eq!(lines[5], r#"                     "consectetur","#);
        assert_eq!(lines[6], r#"                     "adipiscing","#);
        assert_eq!(lines[7], r#"                     "elit",];"#);
        assert_eq!(lines[8], r#"}"#);
        Ok(())
    }

    #[test]
    fn linting_code() {
        let code = r#"
        fn main() {
            let a = 0.0 / 0.0;
            println!("NaN is {}", a);
        }
        "#;

        let req = ClippyRequest {
            code: code.to_string(),
            ..ClippyRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.clippy(&req).expect("Unable to lint code");

        assert!(resp.stderr.contains("deny(clippy::eq_op)"));
        assert!(resp.stderr.contains("warn(clippy::zero_divided_by_zero)"));
    }

    #[test]
    fn linting_code_options() {
        let code = r#"
        use itertools::Itertools; // Edition 2018 feature

        fn example() {
            let a = 0.0 / 0.0;
            println!("NaN is {}", a);
        }
        "#;

        let req = ClippyRequest {
            code: code.to_string(),
            crate_type: CrateType::Library(LibraryType::Rlib),
            edition: Some(Edition::Rust2018),
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.clippy(&req).expect("Unable to lint code");

        assert!(resp.stderr.contains("deny(clippy::eq_op)"));
        assert!(resp.stderr.contains("warn(clippy::zero_divided_by_zero)"));
    }

    #[test]
    fn interpreting_code() -> Result<()> {
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

        let sb = Sandbox::new()?;
        let resp = sb.miri(&req)?;

        assert!(resp.stderr.contains("pointer must be in-bounds at offset 1"), "was: {}", resp.stderr);
        assert!(resp.stderr.contains("outside bounds of allocation"), "was: {}", resp.stderr);
        assert!(resp.stderr.contains("which has size 0"), "was: {}", resp.stderr);
        Ok(())
    }

    #[test]
    fn network_connections_are_disabled() {
        let code = r#"
            fn main() {
                match ::std::net::TcpStream::connect("google.com:80") {
                    Ok(_) => println!("Able to connect to the outside world"),
                    Err(e) => println!("Failed to connect {}, {:?}", e, e),
                }
            }
        "#;

        let req = ExecuteRequest {
            code: code.to_string(),
            ..ExecuteRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stdout.contains("Failed to connect"));
    }

    #[test]
    fn memory_usage_is_limited() {
        let code = r#"
            fn main() {
                let megabyte = 1024 * 1024;
                let mut big = vec![0u8; 384 * megabyte];
                for i in &mut big { *i += 1; }
            }
        "#;

        let req = ExecuteRequest {
            code: code.to_string(),
            ..ExecuteRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stderr.contains("Killed"));
    }

    #[test]
    fn wallclock_time_is_limited() {
        let code = r#"
            fn main() {
                let a_long_time = std::time::Duration::from_secs(20);
                std::thread::sleep(a_long_time);
            }
        "#;

        let req = ExecuteRequest {
            code: code.to_string(),
            ..ExecuteRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stderr.contains("Killed"));
    }

    #[test]
    fn wallclock_time_is_limited_from_outside() {
        let code = r##"
            use std::{process::Command, thread, time::Duration};

            fn main() {
                let output = Command::new("pgrep").args(&["timeout"]).output().unwrap();
                assert!(output.status.success());

                let out = String::from_utf8(output.stdout).expect("Unable to parse output");
                let timeout_pid: u32 = out.trim().parse().expect("Unable to find timeout PID");

                let output = Command::new("sh")
                    .args(&["-c", &format!("kill -s STOP {}", timeout_pid)])
                    .output()
                    .unwrap();
                assert!(output.status.success());

                for _ in 0.. {
                    thread::sleep(Duration::from_secs(1));
                }
            }
        "##;

        let req = ExecuteRequest {
            code: code.to_string(),
            ..ExecuteRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        match sb.execute(&req) {
            Ok(_) => panic!("Expected an error"),
            Err(Error::CompilerExecutionTimedOut{..}) => {/* Ok */}
            Err(e) => panic!("Got the wrong error: {}", e),
        }
    }

    #[test]
    fn number_of_pids_is_limited() {
        let forkbomb = r##"
            fn main() {
                ::std::process::Command::new("sh").arg("-c").arg(r#"
                    z() {
                        z&
                        z
                    }
                    z
                "#).status().unwrap();
            }
        "##;

        let req = ExecuteRequest {
            code: forkbomb.to_string(),
            ..ExecuteRequest::default()
        };

        let sb = Sandbox::new().expect("Unable to create sandbox");
        let resp = sb.execute(&req).expect("Unable to execute code");

        assert!(resp.stderr.contains("Cannot fork"));
    }
}
