use futures::{
    future::{BoxFuture, OptionFuture},
    Future, FutureExt,
};
use snafu::prelude::*;
use std::{
    collections::HashMap,
    fmt, mem, ops,
    process::Stdio,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::{
    join,
    process::{Child, ChildStdin, ChildStdout, Command},
    select,
    sync::{mpsc, oneshot, OnceCell},
    task::{JoinHandle, JoinSet},
    time::{self, MissedTickBehavior},
};
use tokio_stream::{wrappers::ReceiverStream, StreamExt};
use tokio_util::{io::SyncIoBridge, sync::CancellationToken};
use tracing::{instrument, trace, trace_span, warn, Instrument};

use crate::{
    bincode_input_closed,
    message::{
        CoordinatorMessage, DeleteFileRequest, ExecuteCommandRequest, ExecuteCommandResponse,
        JobId, Multiplexed, OneToOneResponse, ReadFileRequest, ReadFileResponse, SerializedError,
        WorkerMessage, WriteFileRequest,
    },
    DropErrorDetailsExt,
};

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
    Hir,
    LlvmIr,
    Mir,
    Wasm,
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum Channel {
    Stable,
    Beta,
    Nightly,
}

impl Channel {
    #[cfg(test)]
    pub(crate) const ALL: [Self; 3] = [Self::Stable, Self::Beta, Self::Nightly];

    #[cfg(test)]
    pub(crate) fn to_str(self) -> &'static str {
        match self {
            Channel::Stable => "stable",
            Channel::Beta => "beta",
            Channel::Nightly => "nightly",
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
    Rust2021,
    Rust2024,
}

impl Edition {
    #[cfg(test)]
    pub(crate) const ALL: [Self; 4] = [
        Self::Rust2015,
        Self::Rust2018,
        Self::Rust2021,
        Self::Rust2024,
    ];

    pub(crate) fn to_str(self) -> &'static str {
        match self {
            Edition::Rust2015 => "2015",
            Edition::Rust2018 => "2018",
            Edition::Rust2021 => "2021",
            Edition::Rust2024 => "2024",
        }
    }

    pub(crate) fn to_cargo_toml_key(self) -> &'static str {
        self.to_str()
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum CrateType {
    Binary,
    Library(LibraryType),
}

impl CrateType {
    const MAIN_RS: &'static str = "src/main.rs";
    const LIB_RS: &'static str = "src/lib.rs";

    pub(crate) fn is_binary(self) -> bool {
        self == CrateType::Binary
    }

    pub(crate) fn primary_path(self) -> &'static str {
        match self {
            CrateType::Binary => Self::MAIN_RS,
            CrateType::Library(_) => Self::LIB_RS,
        }
    }

    pub(crate) fn other_path(self) -> &'static str {
        match self {
            CrateType::Binary => Self::LIB_RS,
            CrateType::Library(_) => Self::MAIN_RS,
        }
    }

    pub(crate) fn to_cargo_toml_key(self) -> &'static str {
        use {CrateType::*, LibraryType::*};

        match self {
            Binary => "bin",
            Library(Lib) => "lib",
            Library(Dylib) => "dylib",
            Library(Rlib) => "rlib",
            Library(Staticlib) => "staticlib",
            Library(Cdylib) => "cdylib",
            Library(ProcMacro) => "proc-macro",
        }
    }

    pub(crate) fn to_library_cargo_toml_key(self) -> Option<&'static str> {
        if self == Self::Binary {
            None
        } else {
            Some(self.to_cargo_toml_key())
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
    ProcMacro,
}

#[derive(Debug, Clone)]
pub struct ExecuteRequest {
    pub channel: Channel,
    pub mode: Mode,
    pub edition: Edition,
    pub crate_type: CrateType,
    pub tests: bool,
    pub backtrace: bool,
    pub code: String,
}

impl ExecuteRequest {
    pub(crate) fn delete_previous_main_request(&self) -> DeleteFileRequest {
        delete_previous_primary_file_request(self.crate_type)
    }

    pub(crate) fn write_main_request(&self) -> WriteFileRequest {
        write_primary_file_request(self.crate_type, &self.code)
    }

    fn execute_cargo_request(&self) -> ExecuteCommandRequest {
        let mut args = vec![];

        let cmd = match (self.tests, self.crate_type.is_binary()) {
            (true, _) => "test",
            (_, true) => "run",
            (_, _) => "build",
        };
        args.push(cmd);

        if let Mode::Release = self.mode {
            args.push("--release");
        }

        let mut envs = HashMap::new();
        if self.backtrace {
            envs.insert("RUST_BACKTRACE".to_owned(), "1".to_owned());
        }

        ExecuteCommandRequest {
            cmd: "cargo".to_owned(),
            args: args.into_iter().map(|s| s.to_owned()).collect(),
            envs,
            cwd: None,
        }
    }
}

impl CargoTomlModifier for ExecuteRequest {
    fn modify_cargo_toml(&self, mut cargo_toml: toml::Value) -> toml::Value {
        if self.edition == Edition::Rust2024 {
            cargo_toml = modify_cargo_toml::set_feature_edition2024(cargo_toml);
        }

        cargo_toml = modify_cargo_toml::set_edition(cargo_toml, self.edition.to_cargo_toml_key());

        if let Some(crate_type) = self.crate_type.to_library_cargo_toml_key() {
            cargo_toml = modify_cargo_toml::set_crate_type(cargo_toml, crate_type);
        }
        cargo_toml
    }
}

#[derive(Debug, Clone)]
pub struct ExecuteResponse {
    pub success: bool,
    pub exit_detail: String,
}

#[derive(Debug, Clone)]
pub struct CompileRequest {
    pub target: CompileTarget,
    pub channel: Channel,
    pub crate_type: CrateType,
    pub mode: Mode,
    pub edition: Edition,
    // TODO: Remove `tests` and `backtrace` -- don't make sense for compiling.
    pub tests: bool,
    pub backtrace: bool,
    pub code: String,
}

impl CompileRequest {
    pub(crate) fn delete_previous_main_request(&self) -> DeleteFileRequest {
        delete_previous_primary_file_request(self.crate_type)
    }

    pub(crate) fn write_main_request(&self) -> WriteFileRequest {
        write_primary_file_request(self.crate_type, &self.code)
    }

    pub(crate) fn execute_cargo_request(&self, output_path: &str) -> ExecuteCommandRequest {
        use CompileTarget::*;

        let mut args = if let Wasm = self.target {
            vec!["wasm"]
        } else {
            vec!["rustc"]
        };
        if let Mode::Release = self.mode {
            args.push("--release");
        }

        match self.target {
            Assembly(flavor, _, _) => {
                args.extend(&["--", "--emit", "asm=compilation"]);

                // Enable extra assembly comments for nightly builds
                if let Channel::Nightly = self.channel {
                    args.push("-Z");
                    args.push("asm-comments");
                }

                args.push("-C");
                match flavor {
                    AssemblyFlavor::Att => args.push("llvm-args=-x86-asm-syntax=att"),
                    AssemblyFlavor::Intel => args.push("llvm-args=-x86-asm-syntax=intel"),
                }
            }
            LlvmIr => args.extend(&["--", "--emit", "llvm-ir=compilation"]),
            Mir => args.extend(&["--", "--emit", "mir=compilation"]),
            Hir => args.extend(&["--", "-Zunpretty=hir", "-o", output_path]),
            Wasm => args.extend(&["-o", output_path]),
        }
        let mut envs = HashMap::new();
        if self.backtrace {
            envs.insert("RUST_BACKTRACE".to_owned(), "1".to_owned());
        }

        ExecuteCommandRequest {
            cmd: "cargo".to_owned(),
            args: args.into_iter().map(|s| s.to_owned()).collect(),
            envs,
            cwd: None,
        }
    }

    pub(crate) fn postprocess_result(&self, mut code: String) -> String {
        if let CompileTarget::Assembly(_, demangle, process) = self.target {
            if demangle == DemangleAssembly::Demangle {
                code = asm_cleanup::demangle_asm(&code);
            }

            if process == ProcessAssembly::Filter {
                code = asm_cleanup::filter_asm(&code);
            }
        }

        code
    }
}

impl CargoTomlModifier for CompileRequest {
    fn modify_cargo_toml(&self, mut cargo_toml: toml::Value) -> toml::Value {
        if self.edition == Edition::Rust2024 {
            cargo_toml = modify_cargo_toml::set_feature_edition2024(cargo_toml);
        }

        cargo_toml = modify_cargo_toml::set_edition(cargo_toml, self.edition.to_cargo_toml_key());

        if let Some(crate_type) = self.crate_type.to_library_cargo_toml_key() {
            cargo_toml = modify_cargo_toml::set_crate_type(cargo_toml, crate_type);
        }

        if CompileTarget::Wasm == self.target {
            cargo_toml = modify_cargo_toml::remove_dependencies(cargo_toml);
            cargo_toml = modify_cargo_toml::set_release_lto(cargo_toml, true);
        }

        cargo_toml
    }
}

#[derive(Debug, Clone)]
pub struct CompileResponse {
    pub success: bool,
    pub exit_detail: String,
    pub code: String,
}

#[derive(Debug, Clone)]
pub struct FormatRequest {
    pub channel: Channel,
    pub crate_type: CrateType,
    pub edition: Edition,
    pub code: String,
}

impl FormatRequest {
    pub(crate) fn delete_previous_main_request(&self) -> DeleteFileRequest {
        delete_previous_primary_file_request(self.crate_type)
    }

    pub(crate) fn write_main_request(&self) -> WriteFileRequest {
        write_primary_file_request(self.crate_type, &self.code)
    }

    pub(crate) fn execute_cargo_request(&self) -> ExecuteCommandRequest {
        ExecuteCommandRequest {
            cmd: "cargo".to_owned(),
            args: vec!["fmt".to_owned()],
            envs: Default::default(),
            cwd: None,
        }
    }
}

impl CargoTomlModifier for FormatRequest {
    fn modify_cargo_toml(&self, mut cargo_toml: toml::Value) -> toml::Value {
        if self.edition == Edition::Rust2024 {
            cargo_toml = modify_cargo_toml::set_feature_edition2024(cargo_toml);
        }

        cargo_toml = modify_cargo_toml::set_edition(cargo_toml, self.edition.to_cargo_toml_key());

        if let Some(crate_type) = self.crate_type.to_library_cargo_toml_key() {
            cargo_toml = modify_cargo_toml::set_crate_type(cargo_toml, crate_type);
        }
        cargo_toml
    }
}

#[derive(Debug, Clone)]
pub struct FormatResponse {
    pub success: bool,
    pub exit_detail: String,
    pub code: String,
}

#[derive(Debug, Clone)]
pub struct ClippyRequest {
    pub channel: Channel,
    pub crate_type: CrateType,
    pub edition: Edition,
    pub code: String,
}

impl ClippyRequest {
    pub(crate) fn delete_previous_main_request(&self) -> DeleteFileRequest {
        delete_previous_primary_file_request(self.crate_type)
    }

    pub(crate) fn write_main_request(&self) -> WriteFileRequest {
        write_primary_file_request(self.crate_type, &self.code)
    }

    pub(crate) fn execute_cargo_request(&self) -> ExecuteCommandRequest {
        ExecuteCommandRequest {
            cmd: "cargo".to_owned(),
            args: vec!["clippy".to_owned()],
            envs: Default::default(),
            cwd: None,
        }
    }
}

impl CargoTomlModifier for ClippyRequest {
    fn modify_cargo_toml(&self, mut cargo_toml: toml::Value) -> toml::Value {
        if self.edition == Edition::Rust2024 {
            cargo_toml = modify_cargo_toml::set_feature_edition2024(cargo_toml);
        }

        cargo_toml = modify_cargo_toml::set_edition(cargo_toml, self.edition.to_cargo_toml_key());

        if let Some(crate_type) = self.crate_type.to_library_cargo_toml_key() {
            cargo_toml = modify_cargo_toml::set_crate_type(cargo_toml, crate_type);
        }
        cargo_toml
    }
}

#[derive(Debug, Clone)]
pub struct ClippyResponse {
    pub success: bool,
    pub exit_detail: String,
}

#[derive(Debug, Clone)]
pub struct WithOutput<T> {
    pub response: T,
    pub stdout: String,
    pub stderr: String,
}

impl<T> WithOutput<T> {
    async fn try_absorb<F, E>(
        task: F,
        stdout_rx: mpsc::Receiver<String>,
        stderr_rx: mpsc::Receiver<String>,
    ) -> Result<WithOutput<T>, E>
    where
        F: Future<Output = Result<T, E>>,
    {
        let stdout = ReceiverStream::new(stdout_rx).collect();
        let stderr = ReceiverStream::new(stderr_rx).collect();

        let (result, stdout, stderr) = join!(task, stdout, stderr);
        let response = result?;

        Ok(WithOutput {
            response,
            stdout,
            stderr,
        })
    }
}

impl<T> ops::Deref for WithOutput<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.response
    }
}

fn write_primary_file_request(crate_type: CrateType, code: &str) -> WriteFileRequest {
    WriteFileRequest {
        path: crate_type.primary_path().to_owned(),
        content: code.into(),
    }
}

fn delete_previous_primary_file_request(crate_type: CrateType) -> DeleteFileRequest {
    DeleteFileRequest {
        path: crate_type.other_path().to_owned(),
    }
}

#[derive(Debug)]
enum DemultiplexCommand {
    Listen(JobId, mpsc::Sender<WorkerMessage>),
    ListenOnce(JobId, oneshot::Sender<WorkerMessage>),
}

#[derive(Debug)]
pub struct Coordinator<B> {
    backend: B,
    // Consider making these lazily-created and/or idly time out
    stable: OnceCell<Container>,
    beta: OnceCell<Container>,
    nightly: OnceCell<Container>,
    token: CancellationToken,
}

impl<B> Coordinator<B>
where
    B: Backend,
{
    pub async fn new(backend: B) -> Self {
        let token = CancellationToken::new();

        Self {
            backend,
            stable: OnceCell::new(),
            beta: OnceCell::new(),
            nightly: OnceCell::new(),
            token,
        }
    }

    pub async fn execute(
        &self,
        request: ExecuteRequest,
    ) -> Result<WithOutput<ExecuteResponse>, ExecuteError> {
        use execute_error::*;

        self.select_channel(request.channel)
            .await
            .context(CouldNotStartContainerSnafu)?
            .execute(request)
            .await
    }

    pub async fn begin_execute(
        &self,
        token: CancellationToken,
        request: ExecuteRequest,
    ) -> Result<ActiveExecution, ExecuteError> {
        use execute_error::*;

        self.select_channel(request.channel)
            .await
            .context(CouldNotStartContainerSnafu)?
            .begin_execute(token, request)
            .await
    }

    pub async fn compile(
        &self,
        request: CompileRequest,
    ) -> Result<WithOutput<CompileResponse>, CompileError> {
        use compile_error::*;

        self.select_channel(request.channel)
            .await
            .context(CouldNotStartContainerSnafu)?
            .compile(request)
            .await
    }

    pub async fn begin_compile(
        &self,
        token: CancellationToken,
        request: CompileRequest,
    ) -> Result<ActiveCompilation, CompileError> {
        use compile_error::*;

        self.select_channel(request.channel)
            .await
            .context(CouldNotStartContainerSnafu)?
            .begin_compile(token, request)
            .await
    }

    pub async fn format(
        &self,
        request: FormatRequest,
    ) -> Result<WithOutput<FormatResponse>, FormatError> {
        use format_error::*;

        self.select_channel(request.channel)
            .await
            .context(CouldNotStartContainerSnafu)?
            .format(request)
            .await
    }

    pub async fn begin_format(
        &self,
        token: CancellationToken,
        request: FormatRequest,
    ) -> Result<ActiveFormatting, FormatError> {
        use format_error::*;

        self.select_channel(request.channel)
            .await
            .context(CouldNotStartContainerSnafu)?
            .begin_format(token, request)
            .await
    }

    pub async fn clippy(
        &self,
        request: ClippyRequest,
    ) -> Result<WithOutput<ClippyResponse>, ClippyError> {
        use clippy_error::*;

        self.select_channel(request.channel)
            .await
            .context(CouldNotStartContainerSnafu)?
            .clippy(request)
            .await
    }

    pub async fn begin_clippy(
        &self,
        token: CancellationToken,
        request: ClippyRequest,
    ) -> Result<ActiveClippy, ClippyError> {
        use clippy_error::*;

        self.select_channel(request.channel)
            .await
            .context(CouldNotStartContainerSnafu)?
            .begin_clippy(token, request)
            .await
    }

    pub async fn idle(&mut self) -> Result<()> {
        let Self {
            stable,
            beta,
            nightly,
            token,
            ..
        } = self;

        let token = mem::take(token);
        token.cancel();

        let channels =
            [stable, beta, nightly].map(|c| OptionFuture::from(c.take().map(|c| c.shutdown())));

        let [stable, beta, nightly] = channels;

        let (stable, beta, nightly) = join!(stable, beta, nightly);

        stable.transpose()?;
        beta.transpose()?;
        nightly.transpose()?;

        Ok(())
    }

    pub async fn shutdown(mut self) -> Result<B> {
        self.idle().await?;
        Ok(self.backend)
    }

    async fn select_channel(&self, channel: Channel) -> Result<&Container, Error> {
        let container = match channel {
            Channel::Stable => &self.stable,
            Channel::Beta => &self.beta,
            Channel::Nightly => &self.nightly,
        };

        container
            .get_or_try_init(|| Container::new(channel, self.token.clone(), &self.backend))
            .await
    }
}

impl Coordinator<DockerBackend> {
    pub async fn new_docker() -> Self {
        Self::new(DockerBackend(())).await
    }
}

#[derive(Debug)]
struct Container {
    task: JoinHandle<Result<()>>,
    modify_cargo_toml: ModifyCargoToml,
    commander: Commander,
}

impl Container {
    async fn new(
        channel: Channel,
        token: CancellationToken,
        backend: &impl Backend,
    ) -> Result<Self> {
        let (mut child, stdin, stdout) = backend.run_worker_in_background(channel)?;
        let IoQueue {
            mut tasks,
            to_worker_tx,
            from_worker_rx,
        } = spawn_io_queue(stdin, stdout, token);

        let (command_tx, command_rx) = mpsc::channel(8);
        let demultiplex_task =
            tokio::spawn(Commander::demultiplex(command_rx, from_worker_rx).in_current_span());

        let task = tokio::spawn(
            async move {
                let (c, d, t) = join!(child.wait(), demultiplex_task, tasks.join_next());
                c.context(JoinWorkerSnafu)?;
                d.context(DemultiplexerTaskPanickedSnafu)?
                    .context(DemultiplexerTaskFailedSnafu)?;
                if let Some(t) = t {
                    t.context(IoQueuePanickedSnafu)??;
                }

                Ok(())
            }
            .in_current_span(),
        );

        let commander = Commander {
            to_worker_tx,
            to_demultiplexer_tx: command_tx,
            id: Default::default(),
        };

        let modify_cargo_toml = ModifyCargoToml::new(commander.clone())
            .await
            .context(CouldNotLoadCargoTomlSnafu)?;

        Ok(Container {
            task,
            modify_cargo_toml,
            commander,
        })
    }

    async fn execute(
        &self,
        request: ExecuteRequest,
    ) -> Result<WithOutput<ExecuteResponse>, ExecuteError> {
        let token = Default::default();

        let ActiveExecution {
            task,
            stdin_tx,
            stdout_rx,
            stderr_rx,
        } = self.begin_execute(token, request).await?;

        drop(stdin_tx);
        WithOutput::try_absorb(task, stdout_rx, stderr_rx).await
    }

    #[instrument(skip_all)]
    async fn begin_execute(
        &self,
        token: CancellationToken,
        request: ExecuteRequest,
    ) -> Result<ActiveExecution, ExecuteError> {
        use execute_error::*;

        let delete_previous_main = request.delete_previous_main_request();
        let write_main = request.write_main_request();
        let execute_cargo = request.execute_cargo_request();

        let delete_previous_main = self.commander.one(delete_previous_main);
        let write_main = self.commander.one(write_main);
        let modify_cargo_toml = self.modify_cargo_toml.modify_for(&request);

        let (delete_previous_main, write_main, modify_cargo_toml) =
            join!(delete_previous_main, write_main, modify_cargo_toml);

        delete_previous_main.context(CouldNotDeletePreviousCodeSnafu)?;
        write_main.context(CouldNotWriteCodeSnafu)?;
        modify_cargo_toml.context(CouldNotModifyCargoTomlSnafu)?;

        let SpawnCargo {
            task,
            stdin_tx,
            stdout_rx,
            stderr_rx,
        } = self
            .spawn_cargo_task(token, execute_cargo)
            .await
            .context(CouldNotStartCargoSnafu)?;

        let task = async move {
            let ExecuteCommandResponse {
                success,
                exit_detail,
            } = task
                .await
                .context(CargoTaskPanickedSnafu)?
                .context(CargoFailedSnafu)?;
            Ok(ExecuteResponse {
                success,
                exit_detail,
            })
        }
        .boxed();

        Ok(ActiveExecution {
            task,
            stdin_tx,
            stdout_rx,
            stderr_rx,
        })
    }

    async fn compile(
        &self,
        request: CompileRequest,
    ) -> Result<WithOutput<CompileResponse>, CompileError> {
        let token = Default::default();

        let ActiveCompilation {
            task,
            stdout_rx,
            stderr_rx,
        } = self.begin_compile(token, request).await?;

        WithOutput::try_absorb(task, stdout_rx, stderr_rx).await
    }

    #[instrument(skip_all)]
    async fn begin_compile(
        &self,
        token: CancellationToken,
        request: CompileRequest,
    ) -> Result<ActiveCompilation, CompileError> {
        use compile_error::*;

        let output_path: &str = "compilation";

        let delete_previous_main = request.delete_previous_main_request();
        let write_main = request.write_main_request();
        let execute_cargo = request.execute_cargo_request(output_path);
        let read_output = ReadFileRequest {
            path: output_path.to_owned(),
        };

        let delete_previous_main = self.commander.one(delete_previous_main);
        let write_main = self.commander.one(write_main);
        let modify_cargo_toml = self.modify_cargo_toml.modify_for(&request);

        let (delete_previous_main, write_main, modify_cargo_toml) =
            join!(delete_previous_main, write_main, modify_cargo_toml);

        delete_previous_main.context(CouldNotDeletePreviousCodeSnafu)?;
        write_main.context(CouldNotWriteCodeSnafu)?;
        modify_cargo_toml.context(CouldNotModifyCargoTomlSnafu)?;

        let SpawnCargo {
            task,
            stdin_tx,
            stdout_rx,
            stderr_rx,
        } = self
            .spawn_cargo_task(token, execute_cargo)
            .await
            .context(CouldNotStartCargoSnafu)?;

        drop(stdin_tx);

        let commander = self.commander.clone();
        let task = async move {
            let ExecuteCommandResponse {
                success,
                exit_detail,
            } = task
                .await
                .context(CargoTaskPanickedSnafu)?
                .context(CargoFailedSnafu)?;

            let code = if success {
                let file: ReadFileResponse = commander
                    .one(read_output)
                    .await
                    .context(CouldNotReadCodeSnafu)?;
                String::from_utf8(file.0).context(CodeNotUtf8Snafu)?
            } else {
                String::new()
            };

            // TODO: This is synchronous...
            let code = request.postprocess_result(code);

            Ok(CompileResponse {
                success,
                exit_detail,
                code,
            })
        }
        .boxed();

        Ok(ActiveCompilation {
            task,
            stdout_rx,
            stderr_rx,
        })
    }

    async fn format(
        &self,
        request: FormatRequest,
    ) -> Result<WithOutput<FormatResponse>, FormatError> {
        let token = Default::default();

        let ActiveFormatting {
            task,
            stdout_rx,
            stderr_rx,
        } = self.begin_format(token, request).await?;

        WithOutput::try_absorb(task, stdout_rx, stderr_rx).await
    }

    async fn begin_format(
        &self,
        token: CancellationToken,
        request: FormatRequest,
    ) -> Result<ActiveFormatting, FormatError> {
        use format_error::*;

        let delete_previous_main = request.delete_previous_main_request();
        let write_main = request.write_main_request();
        let execute_cargo = request.execute_cargo_request();
        let read_output = ReadFileRequest {
            path: request.crate_type.primary_path().to_owned(),
        };

        let delete_previous_main = self.commander.one(delete_previous_main);
        let write_main = self.commander.one(write_main);
        let modify_cargo_toml = self.modify_cargo_toml.modify_for(&request);

        let (delete_previous_main, write_main, modify_cargo_toml) =
            join!(delete_previous_main, write_main, modify_cargo_toml);

        delete_previous_main.context(CouldNotDeletePreviousCodeSnafu)?;
        write_main.context(CouldNotWriteCodeSnafu)?;
        modify_cargo_toml.context(CouldNotModifyCargoTomlSnafu)?;

        let SpawnCargo {
            task,
            stdin_tx,
            stdout_rx,
            stderr_rx,
        } = self
            .spawn_cargo_task(token, execute_cargo)
            .await
            .context(CouldNotStartCargoSnafu)?;

        drop(stdin_tx);

        let commander = self.commander.clone();
        let task = async move {
            let ExecuteCommandResponse {
                success,
                exit_detail,
            } = task
                .await
                .context(CargoTaskPanickedSnafu)?
                .context(CargoFailedSnafu)?;

            let file = commander
                .one(read_output)
                .await
                .context(CouldNotReadCodeSnafu)?;
            let code = String::from_utf8(file.0).context(CodeNotUtf8Snafu)?;

            Ok(FormatResponse {
                success,
                exit_detail,
                code,
            })
        }
        .boxed();

        Ok(ActiveFormatting {
            task,
            stdout_rx,
            stderr_rx,
        })
    }

    async fn clippy(
        &self,
        request: ClippyRequest,
    ) -> Result<WithOutput<ClippyResponse>, ClippyError> {
        let token = Default::default();

        let ActiveClippy {
            task,
            stdout_rx,
            stderr_rx,
        } = self.begin_clippy(token, request).await?;

        WithOutput::try_absorb(task, stdout_rx, stderr_rx).await
    }

    async fn begin_clippy(
        &self,
        token: CancellationToken,
        request: ClippyRequest,
    ) -> Result<ActiveClippy, ClippyError> {
        use clippy_error::*;

        let delete_previous_main = request.delete_previous_main_request();
        let write_main = request.write_main_request();
        let execute_cargo = request.execute_cargo_request();

        let delete_previous_main = self.commander.one(delete_previous_main);
        let write_main = self.commander.one(write_main);
        let modify_cargo_toml = self.modify_cargo_toml.modify_for(&request);

        let (delete_previous_main, write_main, modify_cargo_toml) =
            join!(delete_previous_main, write_main, modify_cargo_toml);

        delete_previous_main.context(CouldNotDeletePreviousCodeSnafu)?;
        write_main.context(CouldNotWriteCodeSnafu)?;
        modify_cargo_toml.context(CouldNotModifyCargoTomlSnafu)?;

        let SpawnCargo {
            task,
            stdin_tx,
            stdout_rx,
            stderr_rx,
        } = self
            .spawn_cargo_task(token, execute_cargo)
            .await
            .context(CouldNotStartCargoSnafu)?;

        drop(stdin_tx);

        let task = async move {
            let ExecuteCommandResponse {
                success,
                exit_detail,
            } = task
                .await
                .context(CargoTaskPanickedSnafu)?
                .context(CargoFailedSnafu)?;

            Ok(ClippyResponse {
                success,
                exit_detail,
            })
        }
        .boxed();

        Ok(ActiveClippy {
            task,
            stdout_rx,
            stderr_rx,
        })
    }

    async fn spawn_cargo_task(
        &self,
        token: CancellationToken,
        execute_cargo: ExecuteCommandRequest,
    ) -> Result<SpawnCargo, SpawnCargoError> {
        use spawn_cargo_error::*;

        let (stdin_tx, mut stdin_rx) = mpsc::channel(8);
        let (stdout_tx, stdout_rx) = mpsc::channel(8);
        let (stderr_tx, stderr_rx) = mpsc::channel(8);

        let (to_worker_tx, mut from_worker_rx) = self
            .commander
            .many(execute_cargo)
            .await
            .context(CouldNotStartCargoSnafu)?;

        let task = tokio::spawn({
            async move {
                let mut already_cancelled = false;
                let mut stdin_open = true;

                loop {
                    select! {
                        () = token.cancelled(), if !already_cancelled => {
                            already_cancelled = true;

                            let msg = CoordinatorMessage::Kill;
                            trace!("processing {msg:?}");
                            to_worker_tx.send(msg).await.context(KillSnafu)?;
                        },

                        stdin = stdin_rx.recv(), if stdin_open => {
                            let msg = match stdin {
                                Some(stdin) => {
                                    CoordinatorMessage::StdinPacket(stdin)
                                }

                                None => {
                                    stdin_open = false;
                                    CoordinatorMessage::StdinClose
                                }
                            };

                            trace!("processing {msg:?}");
                            to_worker_tx.send(msg).await.context(StdinSnafu)?;
                        },

                        Some(container_msg) = from_worker_rx.recv() => {
                            trace!("processing {container_msg:?}");

                            match container_msg {
                                WorkerMessage::ExecuteCommand(resp) => {
                                    return Ok(resp);
                                }
                                WorkerMessage::StdoutPacket(packet) => {
                                    stdout_tx.send(packet).await.ok(/* Receiver gone, that's OK */);
                                }
                                WorkerMessage::StderrPacket(packet) => {
                                    stderr_tx.send(packet).await.ok(/* Receiver gone, that's OK */);
                                }
                                _ => return UnexpectedMessageSnafu.fail(),
                            }
                        },

                        else => return UnexpectedEndOfMessagesSnafu.fail(),
                    }
                }
            }
            .instrument(trace_span!("cargo task").or_current())
        });

        Ok(SpawnCargo {
            task,
            stdin_tx,
            stdout_rx,
            stderr_rx,
        })
    }

    async fn shutdown(self) -> Result<()> {
        let Self {
            task,
            modify_cargo_toml,
            commander,
        } = self;
        drop(commander);
        drop(modify_cargo_toml);
        task.await.context(ContainerTaskPanickedSnafu)?
    }
}

pub struct ActiveExecution {
    pub task: BoxFuture<'static, Result<ExecuteResponse, ExecuteError>>,
    pub stdin_tx: mpsc::Sender<String>,
    pub stdout_rx: mpsc::Receiver<String>,
    pub stderr_rx: mpsc::Receiver<String>,
}

impl fmt::Debug for ActiveExecution {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ActiveExecution")
            .field("task", &"<future>")
            .field("stdin_tx", &self.stdin_tx)
            .field("stdout_rx", &self.stdout_rx)
            .field("stderr_rx", &self.stderr_rx)
            .finish()
    }
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum ExecuteError {
    #[snafu(display("Could not start the container"))]
    CouldNotStartContainer { source: Error },

    #[snafu(display("Could not modify Cargo.toml"))]
    CouldNotModifyCargoToml { source: ModifyCargoTomlError },

    #[snafu(display("Could not delete previous source code"))]
    CouldNotDeletePreviousCode { source: CommanderError },

    #[snafu(display("Could not write source code"))]
    CouldNotWriteCode { source: CommanderError },

    #[snafu(display("Could not start Cargo task"))]
    CouldNotStartCargo { source: SpawnCargoError },

    #[snafu(display("The Cargo task panicked"))]
    CargoTaskPanicked { source: tokio::task::JoinError },

    #[snafu(display("Cargo task failed"))]
    CargoFailed { source: SpawnCargoError },
}

pub struct ActiveCompilation {
    pub task: BoxFuture<'static, Result<CompileResponse, CompileError>>,
    pub stdout_rx: mpsc::Receiver<String>,
    pub stderr_rx: mpsc::Receiver<String>,
}

impl fmt::Debug for ActiveCompilation {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ActiveCompilation")
            .field("task", &"<future>")
            .field("stdout_rx", &self.stdout_rx)
            .field("stderr_rx", &self.stderr_rx)
            .finish()
    }
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum CompileError {
    #[snafu(display("Could not start the container"))]
    CouldNotStartContainer { source: Error },

    #[snafu(display("Could not modify Cargo.toml"))]
    CouldNotModifyCargoToml { source: ModifyCargoTomlError },

    #[snafu(display("Could not delete previous source code"))]
    CouldNotDeletePreviousCode { source: CommanderError },

    #[snafu(display("Could not write source code"))]
    CouldNotWriteCode { source: CommanderError },

    #[snafu(display("Could not start Cargo task"))]
    CouldNotStartCargo { source: SpawnCargoError },

    #[snafu(display("The Cargo task panicked"))]
    CargoTaskPanicked { source: tokio::task::JoinError },

    #[snafu(display("Cargo task failed"))]
    CargoFailed { source: SpawnCargoError },

    #[snafu(display("Could not read the compilation output"))]
    CouldNotReadCode { source: CommanderError },

    #[snafu(display("The compilation output was not UTF-8"))]
    CodeNotUtf8 { source: std::string::FromUtf8Error },
}

pub struct ActiveFormatting {
    pub task: BoxFuture<'static, Result<FormatResponse, FormatError>>,
    pub stdout_rx: mpsc::Receiver<String>,
    pub stderr_rx: mpsc::Receiver<String>,
}

impl fmt::Debug for ActiveFormatting {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ActiveFormatting")
            .field("task", &"<future>")
            .field("stdout_rx", &self.stdout_rx)
            .field("stderr_rx", &self.stderr_rx)
            .finish()
    }
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum FormatError {
    #[snafu(display("Could not start the container"))]
    CouldNotStartContainer { source: Error },

    #[snafu(display("Could not modify Cargo.toml"))]
    CouldNotModifyCargoToml { source: ModifyCargoTomlError },

    #[snafu(display("Could not delete previous source code"))]
    CouldNotDeletePreviousCode { source: CommanderError },

    #[snafu(display("Could not write source code"))]
    CouldNotWriteCode { source: CommanderError },

    #[snafu(display("Could not start Cargo task"))]
    CouldNotStartCargo { source: SpawnCargoError },

    #[snafu(display("The Cargo task panicked"))]
    CargoTaskPanicked { source: tokio::task::JoinError },

    #[snafu(display("Cargo task failed"))]
    CargoFailed { source: SpawnCargoError },

    #[snafu(display("Could not read the compilation output"))]
    CouldNotReadCode { source: CommanderError },

    #[snafu(display("The compilation output was not UTF-8"))]
    CodeNotUtf8 { source: std::string::FromUtf8Error },
}

pub struct ActiveClippy {
    pub task: BoxFuture<'static, Result<ClippyResponse, ClippyError>>,
    pub stdout_rx: mpsc::Receiver<String>,
    pub stderr_rx: mpsc::Receiver<String>,
}

impl fmt::Debug for ActiveClippy {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ActiveClippy")
            .field("task", &"<future>")
            .field("stdout_rx", &self.stdout_rx)
            .field("stderr_rx", &self.stderr_rx)
            .finish()
    }
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum ClippyError {
    #[snafu(display("Could not start the container"))]
    CouldNotStartContainer { source: Error },

    #[snafu(display("Could not modify Cargo.toml"))]
    CouldNotModifyCargoToml { source: ModifyCargoTomlError },

    #[snafu(display("Could not delete previous source code"))]
    CouldNotDeletePreviousCode { source: CommanderError },

    #[snafu(display("Could not write source code"))]
    CouldNotWriteCode { source: CommanderError },

    #[snafu(display("Could not start Cargo task"))]
    CouldNotStartCargo { source: SpawnCargoError },

    #[snafu(display("The Cargo task panicked"))]
    CargoTaskPanicked { source: tokio::task::JoinError },

    #[snafu(display("Cargo task failed"))]
    CargoFailed { source: SpawnCargoError },
}

struct SpawnCargo {
    task: JoinHandle<Result<ExecuteCommandResponse, SpawnCargoError>>,
    stdin_tx: mpsc::Sender<String>,
    stdout_rx: mpsc::Receiver<String>,
    stderr_rx: mpsc::Receiver<String>,
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum SpawnCargoError {
    #[snafu(display("Could not start Cargo"))]
    CouldNotStartCargo { source: CommanderError },

    #[snafu(display("Received an unexpected message"))]
    UnexpectedMessage,

    #[snafu(display("There are no more messages"))]
    UnexpectedEndOfMessages,

    #[snafu(display("Unable to send stdin message"))]
    Stdin { source: MultiplexedSenderError },

    #[snafu(display("Unable to send kill message"))]
    Kill { source: MultiplexedSenderError },
}

#[derive(Debug, Clone)]
struct Commander {
    to_worker_tx: mpsc::Sender<Multiplexed<CoordinatorMessage>>,
    to_demultiplexer_tx: mpsc::Sender<(oneshot::Sender<()>, DemultiplexCommand)>,
    id: Arc<AtomicU64>,
}

trait CargoTomlModifier {
    fn modify_cargo_toml(&self, cargo_toml: toml::Value) -> toml::Value;
}

#[derive(Debug)]
struct ModifyCargoToml {
    commander: Commander,
    cargo_toml: toml::Value,
}

impl ModifyCargoToml {
    const PATH: &'static str = "Cargo.toml";

    async fn new(commander: Commander) -> Result<Self, ModifyCargoTomlError> {
        let cargo_toml = Self::read(&commander).await?;
        Ok(Self {
            commander,
            cargo_toml,
        })
    }

    async fn modify_for(
        &self,
        request: &impl CargoTomlModifier,
    ) -> Result<(), ModifyCargoTomlError> {
        let cargo_toml = self.cargo_toml.clone();
        let cargo_toml = request.modify_cargo_toml(cargo_toml);
        Self::write(&self.commander, cargo_toml).await
    }

    async fn read(commander: &Commander) -> Result<toml::Value, ModifyCargoTomlError> {
        use modify_cargo_toml_error::*;

        let path = Self::PATH.to_owned();
        let cargo_toml = commander
            .one(ReadFileRequest { path })
            .await
            .context(CouldNotReadSnafu)?;

        let cargo_toml = String::from_utf8(cargo_toml.0)?;
        let cargo_toml = toml::from_str(&cargo_toml)?;

        Ok(cargo_toml)
    }

    async fn write(
        commander: &Commander,
        cargo_toml: toml::Value,
    ) -> Result<(), ModifyCargoTomlError> {
        use modify_cargo_toml_error::*;

        let cargo_toml = toml::to_string(&cargo_toml)?;
        let content = cargo_toml.into_bytes();

        let path = Self::PATH.to_owned();
        commander
            .one(WriteFileRequest { path, content })
            .await
            .context(CouldNotWriteSnafu)?;

        Ok(())
    }
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum ModifyCargoTomlError {
    #[snafu(display("Could not read the file"))]
    CouldNotRead { source: CommanderError },

    #[snafu(display("Could not parse the file as UTF-8"))]
    #[snafu(context(false))]
    InvalidUtf8 { source: std::string::FromUtf8Error },

    #[snafu(display("Could not deserialize the file as TOML"))]
    #[snafu(context(false))]
    CouldNotDeserialize { source: toml::de::Error },

    #[snafu(display("Could not serialize the file as TOML"))]
    #[snafu(context(false))]
    CouldNotSerialize { source: toml::ser::Error },

    #[snafu(display("Could not write the file"))]
    CouldNotWrite { source: CommanderError },
}

struct MultiplexedSender {
    job_id: JobId,
    to_worker_tx: mpsc::Sender<Multiplexed<CoordinatorMessage>>,
}

impl MultiplexedSender {
    async fn send(
        &self,
        message: impl Into<CoordinatorMessage>,
    ) -> Result<(), MultiplexedSenderError> {
        use multiplexed_sender_error::*;

        let message = message.into();
        let message = Multiplexed(self.job_id, message);

        self.to_worker_tx
            .send(message)
            .await
            .drop_error_details()
            .context(MultiplexedSenderSnafu)
    }
}

#[derive(Debug, Snafu)]
#[snafu(module)]
#[snafu(display("Could not send a message to the worker"))]
pub struct MultiplexedSenderError {
    source: mpsc::error::SendError<()>,
}

impl Commander {
    const GC_PERIOD: Duration = Duration::from_secs(30);

    #[instrument(skip_all)]
    async fn demultiplex(
        mut command_rx: mpsc::Receiver<(oneshot::Sender<()>, DemultiplexCommand)>,
        mut from_worker_rx: mpsc::Receiver<Multiplexed<WorkerMessage>>,
    ) -> Result<(), CommanderError> {
        use commander_error::*;

        let mut waiting = HashMap::new();
        let mut waiting_once = HashMap::new();

        let mut gc_interval = time::interval(Self::GC_PERIOD);
        gc_interval.set_missed_tick_behavior(MissedTickBehavior::Delay);

        loop {
            select! {
                command = command_rx.recv() => {
                    let Some((ack_tx, command)) = command else { break };

                    match command {
                        DemultiplexCommand::Listen(job_id, waiter) => {
                            trace!("adding listener for {job_id:?}");
                            let old = waiting.insert(job_id, waiter);
                            ensure!(old.is_none(), DuplicateDemultiplexerClientSnafu { job_id });
                        }

                        DemultiplexCommand::ListenOnce(job_id, waiter) => {
                            trace!("adding listener for {job_id:?}");
                            let old = waiting_once.insert(job_id, waiter);
                            ensure!(old.is_none(), DuplicateDemultiplexerClientSnafu { job_id });
                        }
                    }

                    ack_tx.send(()).ok(/* Don't care about it */);
                },

                msg = from_worker_rx.recv() => {
                    let Some(Multiplexed(job_id, msg)) = msg else { break };

                    if let Some(waiter) = waiting_once.remove(&job_id) {
                        trace!("notifying listener for {job_id:?}");
                        waiter.send(msg).ok(/* Don't care about it */);
                        continue;
                    }

                    if let Some(waiter) = waiting.get(&job_id) {
                        trace!("notifying listener for {job_id:?}");
                        waiter.send(msg).await.ok(/* Don't care about it */);
                        continue;
                    }

                    warn!("no listener for {job_id:?}");
                }

                // Find any channels where the receivers have been
                // dropped and clear out the sending halves.
                _ = gc_interval.tick() => {
                    waiting = mem::take(&mut waiting)
                        .into_iter()
                        .filter(|(_job_id, tx)| !tx.is_closed())
                        .collect();

                    waiting_once = mem::take(&mut waiting_once)
                        .into_iter()
                        .filter(|(_job_id, tx)| !tx.is_closed())
                        .collect();
                }
            }
        }

        Ok(())
    }

    fn next_id(&self) -> JobId {
        self.id.fetch_add(1, Ordering::SeqCst)
    }

    async fn send_to_demultiplexer(
        &self,
        command: DemultiplexCommand,
    ) -> Result<(), CommanderError> {
        use commander_error::*;

        let (ack_tx, ack_rx) = oneshot::channel();

        self.to_demultiplexer_tx
            .send((ack_tx, command))
            .await
            .drop_error_details()
            .context(UnableToSendToDemultiplexerSnafu)?;

        ack_rx.await.context(DemultiplexerDidNotRespondSnafu)
    }

    fn build_multiplexed_sender(&self, job_id: JobId) -> MultiplexedSender {
        let to_worker_tx = self.to_worker_tx.clone();
        MultiplexedSender {
            job_id,
            to_worker_tx,
        }
    }

    async fn one<M>(&self, message: M) -> Result<M::Response, CommanderError>
    where
        M: Into<CoordinatorMessage>,
        M: OneToOneResponse,
        Result<M::Response, SerializedError>: TryFrom<WorkerMessage>,
    {
        use commander_error::*;

        let id = self.next_id();
        let to_worker_tx = self.build_multiplexed_sender(id);
        let (from_demultiplexer_tx, from_demultiplexer_rx) = oneshot::channel();

        self.send_to_demultiplexer(DemultiplexCommand::ListenOnce(id, from_demultiplexer_tx))
            .await?;
        to_worker_tx
            .send(message)
            .await
            .context(UnableToStartOneSnafu)?;
        let msg = from_demultiplexer_rx
            .await
            .context(UnableToReceiveFromDemultiplexerSnafu)?;

        match msg.try_into() {
            Ok(Ok(v)) => Ok(v),
            Ok(Err(e)) => WorkerOperationFailedSnafu { text: e.0 }.fail(),
            Err(_) => UnexpectedResponseTypeSnafu.fail(),
        }
    }

    async fn many<M>(
        &self,
        message: M,
    ) -> Result<(MultiplexedSender, mpsc::Receiver<WorkerMessage>), CommanderError>
    where
        M: Into<CoordinatorMessage>,
    {
        use commander_error::*;

        let id = self.next_id();
        let to_worker_tx = self.build_multiplexed_sender(id);
        let (from_worker_tx, from_worker_rx) = mpsc::channel(8);

        self.send_to_demultiplexer(DemultiplexCommand::Listen(id, from_worker_tx))
            .await?;
        to_worker_tx
            .send(message)
            .await
            .context(UnableToStartManySnafu)?;

        Ok((to_worker_tx, from_worker_rx))
    }
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum CommanderError {
    #[snafu(display("Two listeners subscribed to job {job_id}"))]
    DuplicateDemultiplexerClient { job_id: JobId },

    #[snafu(display("Could not send a message to the demultiplexer"))]
    UnableToSendToDemultiplexer { source: mpsc::error::SendError<()> },

    #[snafu(display("Could not send a message to the demultiplexer"))]
    DemultiplexerDidNotRespond { source: oneshot::error::RecvError },

    #[snafu(display("Did not receive a response from the demultiplexer"))]
    UnableToReceiveFromDemultiplexer { source: oneshot::error::RecvError },

    #[snafu(display("Could not start single request/response interaction"))]
    UnableToStartOne { source: MultiplexedSenderError },

    #[snafu(display("Could not start continuous interaction"))]
    UnableToStartMany { source: MultiplexedSenderError },

    #[snafu(display("Did not receive the expected response type from the worker"))]
    UnexpectedResponseType,

    #[snafu(display("The worker operation failed: {text}"))]
    WorkerOperationFailed { text: String },
}

pub trait Backend {
    fn run_worker_in_background(
        &self,
        channel: Channel,
    ) -> Result<(Child, ChildStdin, ChildStdout)> {
        let mut child = self
            .prepare_worker_command(channel)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .context(SpawnWorkerSnafu)?;
        let stdin = child.stdin.take().context(WorkerStdinCaptureSnafu)?;
        let stdout = child.stdout.take().context(WorkerStdoutCaptureSnafu)?;
        Ok((child, stdin, stdout))
    }

    fn prepare_worker_command(&self, channel: Channel) -> Command;
}

impl<B> Backend for &B
where
    B: Backend,
{
    fn prepare_worker_command(&self, channel: Channel) -> Command {
        B::prepare_worker_command(self, channel)
    }
}

macro_rules! docker_command {
    ($($arg:expr),* $(,)?) => ({
        let mut cmd = Command::new("docker");
        $( cmd.arg($arg); )*
        cmd
    });
}

macro_rules! docker_target_arch {
    (x86_64: $x:expr, aarch64: $a:expr $(,)?) => {{
        #[cfg(target_arch = "x86_64")]
        {
            $x
        }

        #[cfg(target_arch = "aarch64")]
        {
            $a
        }
    }};
}

const DOCKER_ARCH: &str = docker_target_arch! {
    x86_64: "linux/amd64",
    aarch64: "linux/arm64",
};

fn basic_secure_docker_command() -> Command {
    docker_command!(
        "run",
        "--platform",
        DOCKER_ARCH,
        "--cap-drop=ALL",
        "--net",
        "none",
        "--memory",
        "512m",
        "--memory-swap",
        "640m",
        "--pids-limit",
        "512",
        "--oom-score-adj",
        "1000",
    )
}

pub struct DockerBackend(());

impl Backend for DockerBackend {
    fn prepare_worker_command(&self, channel: Channel) -> Command {
        let mut command = basic_secure_docker_command();
        command
            .arg("-i")
            .args(["-a", "stdin", "-a", "stdout", "-a", "stderr"])
            .args(["-e", "PLAYGROUND_ORCHESTRATOR=1"])
            .arg("--rm")
            .arg(channel.to_container_name())
            .arg("worker")
            .arg("/playground");
        command
    }
}

impl Channel {
    fn to_container_name(self) -> &'static str {
        match self {
            Channel::Stable => "rust-stable",
            Channel::Beta => "rust-beta",
            Channel::Nightly => "rust-nightly",
        }
    }
}

pub type Result<T, E = Error> = ::std::result::Result<T, E>;

#[derive(Debug, Snafu)]
pub enum Error {
    #[snafu(display("Reached system process limit"))]
    SpawnWorker { source: std::io::Error },

    #[snafu(display("Unable to join child process"))]
    JoinWorker { source: std::io::Error },

    #[snafu(display("The demultiplexer task panicked"))]
    DemultiplexerTaskPanicked { source: tokio::task::JoinError },

    #[snafu(display("The demultiplexer task failed"))]
    DemultiplexerTaskFailed { source: CommanderError },

    #[snafu(display("The IO queue task panicked"))]
    IoQueuePanicked { source: tokio::task::JoinError },

    #[snafu(display("The container task panicked"))]
    ContainerTaskPanicked { source: tokio::task::JoinError },

    #[snafu(display("Worker process's stdin not captured"))]
    WorkerStdinCapture,

    #[snafu(display("Worker process's stdout not captured"))]
    WorkerStdoutCapture,

    #[snafu(display("Failed to flush child stdin"))]
    WorkerStdinFlush { source: std::io::Error },

    #[snafu(display("Failed to deserialize worker message"))]
    WorkerMessageDeserialization { source: bincode::Error },

    #[snafu(display("Failed to serialize coordinator message"))]
    CoordinatorMessageSerialization { source: bincode::Error },

    #[snafu(display("Failed to send worker message through channel"))]
    UnableToSendWorkerMessage { source: mpsc::error::SendError<()> },

    #[snafu(display("Unable to load original Cargo.toml"))]
    CouldNotLoadCargoToml { source: ModifyCargoTomlError },
}

struct IoQueue {
    tasks: JoinSet<Result<()>>,
    to_worker_tx: mpsc::Sender<Multiplexed<CoordinatorMessage>>,
    from_worker_rx: mpsc::Receiver<Multiplexed<WorkerMessage>>,
}

// Child stdin/out <--> messages.
fn spawn_io_queue(stdin: ChildStdin, stdout: ChildStdout, token: CancellationToken) -> IoQueue {
    use std::io::{prelude::*, BufReader, BufWriter};

    let mut tasks = JoinSet::new();

    let (tx, from_worker_rx) = mpsc::channel(8);
    tasks.spawn_blocking(move || {
        let stdout = SyncIoBridge::new(stdout);
        let mut stdout = BufReader::new(stdout);

        loop {
            let worker_msg = bincode::deserialize_from(&mut stdout);

            if bincode_input_closed(&worker_msg) {
                break;
            };

            let worker_msg = worker_msg.context(WorkerMessageDeserializationSnafu)?;

            tx.blocking_send(worker_msg)
                .drop_error_details()
                .context(UnableToSendWorkerMessageSnafu)?;
        }

        Ok(())
    });

    let (to_worker_tx, mut rx) = mpsc::channel(8);
    tasks.spawn_blocking(move || {
        let stdin = SyncIoBridge::new(stdin);
        let mut stdin = BufWriter::new(stdin);

        loop {
            let coordinator_msg = futures::executor::block_on(async {
                select! {
                    () = token.cancelled() => None,
                    msg = rx.recv() => msg,
                }
            });

            let Some(coordinator_msg) = coordinator_msg else {
                break;
            };

            bincode::serialize_into(&mut stdin, &coordinator_msg)
                .context(CoordinatorMessageSerializationSnafu)?;

            stdin.flush().context(WorkerStdinFlushSnafu)?;
        }

        Ok(())
    });

    IoQueue {
        tasks,
        to_worker_tx,
        from_worker_rx,
    }
}

#[cfg(test)]
mod tests {
    use assertables::*;
    use futures::{future::try_join_all, Future, FutureExt};
    use once_cell::sync::Lazy;
    use std::{env, sync::Once, time::Duration};
    use tempdir::TempDir;
    use tokio::sync::{OwnedSemaphorePermit, Semaphore};

    use super::*;

    #[allow(dead_code)]
    fn setup_tracing() {
        use tracing::Level;
        use tracing_subscriber::fmt::TestWriter;

        tracing_subscriber::fmt()
            .with_ansi(false)
            .with_max_level(Level::TRACE)
            .with_writer(TestWriter::new())
            .try_init()
            .ok();
    }

    #[derive(Debug)]
    struct TestBackend {
        project_dir: TempDir,
    }

    impl TestBackend {
        fn new() -> Self {
            static COMPILE_WORKER_ONCE: Once = Once::new();

            COMPILE_WORKER_ONCE.call_once(|| {
                let output = std::process::Command::new("cargo")
                    .arg("build")
                    .output()
                    .expect("Build failed");
                assert!(output.status.success(), "Build failed");
            });

            let project_dir =
                TempDir::new("playground").expect("Failed to create temporary project directory");

            for channel in Channel::ALL {
                let channel = channel.to_str();
                let channel_dir = project_dir.path().join(channel);

                let output = std::process::Command::new("cargo")
                    .arg(format!("+{channel}"))
                    .arg("new")
                    .args(["--name", "playground"])
                    .arg(&channel_dir)
                    .output()
                    .expect("Cargo new failed");
                assert!(output.status.success(), "Cargo new failed");

                let main = channel_dir.join("src").join("main.rs");
                std::fs::remove_file(main).expect("Could not delete main.rs");
            }

            Self { project_dir }
        }
    }

    impl Backend for TestBackend {
        fn prepare_worker_command(&self, channel: Channel) -> Command {
            let channel_dir = self.project_dir.path().join(channel.to_str());

            let mut command = Command::new("./target/debug/worker");
            command.env("RUSTUP_TOOLCHAIN", channel.to_str());
            command.arg(channel_dir);
            command
        }
    }

    const MAX_CONCURRENT_TESTS: Lazy<usize> = Lazy::new(|| {
        env::var("TESTS_MAX_CONCURRENCY")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(5)
    });

    static CONCURRENT_TEST_SEMAPHORE: Lazy<Arc<Semaphore>> =
        Lazy::new(|| Arc::new(Semaphore::new(*MAX_CONCURRENT_TESTS)));

    struct RestrictedCoordinator<T> {
        _permit: OwnedSemaphorePermit,
        coordinator: Coordinator<T>,
    }

    impl<T> RestrictedCoordinator<T>
    where
        T: Backend,
    {
        async fn with<F, Fut>(f: F) -> Self
        where
            F: FnOnce() -> Fut,
            Fut: Future<Output = Coordinator<T>>,
        {
            let semaphore = CONCURRENT_TEST_SEMAPHORE.clone();
            let permit = semaphore
                .acquire_owned()
                .await
                .expect("Unable to acquire permit");
            let coordinator = f().await;
            Self {
                _permit: permit,
                coordinator,
            }
        }

        async fn shutdown(self) -> super::Result<T, super::Error> {
            self.coordinator.shutdown().await
        }
    }

    impl<T> ops::Deref for RestrictedCoordinator<T> {
        type Target = Coordinator<T>;

        fn deref(&self) -> &Self::Target {
            &self.coordinator
        }
    }

    impl<T> ops::DerefMut for RestrictedCoordinator<T> {
        fn deref_mut(&mut self) -> &mut Self::Target {
            &mut self.coordinator
        }
    }

    async fn new_coordinator_test() -> RestrictedCoordinator<impl Backend> {
        RestrictedCoordinator::with(|| Coordinator::new(TestBackend::new())).await
    }

    async fn new_coordinator_docker() -> RestrictedCoordinator<impl Backend> {
        RestrictedCoordinator::with(|| Coordinator::new_docker()).await
    }

    async fn new_coordinator() -> RestrictedCoordinator<impl Backend> {
        #[cfg(not(force_docker))]
        {
            new_coordinator_test().await
        }

        #[cfg(force_docker)]
        {
            new_coordinator_docker().await
        }
    }

    const ARBITRARY_EXECUTE_REQUEST: ExecuteRequest = ExecuteRequest {
        channel: Channel::Stable,
        mode: Mode::Debug,
        edition: Edition::Rust2021,
        crate_type: CrateType::Binary,
        tests: false,
        backtrace: false,
        code: String::new(),
    };

    fn new_execute_request() -> ExecuteRequest {
        ExecuteRequest {
            code: r#"fn main() { println!("Hello, coordinator!"); }"#.into(),
            ..ARBITRARY_EXECUTE_REQUEST
        }
    }

    #[tokio::test]
    #[snafu::report]
    async fn execute_response() -> Result<()> {
        let coordinator = new_coordinator().await;

        let response = coordinator
            .execute(new_execute_request())
            .with_timeout()
            .await
            .unwrap();

        assert!(response.success, "stderr: {}", response.stderr);
        assert_contains!(response.stderr, "Compiling");
        assert_contains!(response.stderr, "Finished");
        assert_contains!(response.stderr, "Running");
        assert_contains!(response.stdout, "Hello, coordinator!");

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn execute_mode() -> Result<()> {
        let params = [
            (Mode::Debug, "[unoptimized + debuginfo]"),
            (Mode::Release, "[optimized]"),
        ];

        let tests = params.into_iter().map(|(mode, expected)| async move {
            let coordinator = new_coordinator().await;

            let request = ExecuteRequest {
                mode,
                ..new_execute_request()
            };
            let response = coordinator.execute(request).await.unwrap();

            assert!(response.success, "({mode:?}) stderr: {}", response.stderr);
            assert_contains!(response.stderr, expected);

            coordinator.shutdown().await?;

            Ok(())
        });

        try_join_all(tests).with_timeout().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn execute_edition() -> Result<()> {
        let params = [
            (r#"fn x() { let dyn = true; }"#, [true, false, false, false]),
            (
                r#"fn x() { u16::try_from(1u8); }"#,
                [false, false, true, true],
            ),
            (
                r#"#![feature(gen_blocks)]
                   fn x() { gen { yield 1u8 }; }"#,
                [false, false, false, true],
            ),
        ];

        let tests = params.into_iter().flat_map(|(code, works_in)| {
            Edition::ALL.into_iter().zip(works_in).map(
                move |(edition, expected_to_work)| async move {
                    let coordinator = new_coordinator().await;

                    let request = ExecuteRequest {
                        code: code.into(),
                        edition,
                        crate_type: CrateType::Library(LibraryType::Lib),
                        channel: Channel::Nightly, // To allow 2024 while it is unstable
                        ..ARBITRARY_EXECUTE_REQUEST
                    };
                    let response = coordinator.execute(request).await.unwrap();

                    assert_eq!(
                        response.success, expected_to_work,
                        "({edition:?}), stderr: {}",
                        response.stderr,
                    );

                    coordinator.shutdown().await?;

                    Ok(())
                },
            )
        });

        try_join_all(tests).with_timeout().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn execute_crate_type() -> Result<()> {
        let params = [
            (CrateType::Binary, "Running `target"),
            (
                CrateType::Library(LibraryType::Cdylib),
                "function `main` is never used",
            ),
        ];

        let tests = params.into_iter().map(|(crate_type, expected)| async move {
            let coordinator = new_coordinator().await;

            let request = ExecuteRequest {
                crate_type,
                ..new_execute_request()
            };
            let response = coordinator.execute(request).await.unwrap();

            assert!(
                response.success,
                "({crate_type:?}), stderr: {}",
                response.stderr,
            );
            assert_contains!(response.stderr, expected);

            coordinator.shutdown().await?;

            Ok(())
        });

        try_join_all(tests).with_timeout().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn execute_tests() -> Result<()> {
        let code = r#"fn main() {} #[test] fn test() {}"#;

        let params = [(false, "Running `"), (true, "Running unittests")];

        let tests = params.into_iter().map(|(tests, expected)| async move {
            let coordinator = new_coordinator().await;

            let request = ExecuteRequest {
                code: code.into(),
                tests,
                ..new_execute_request()
            };
            let response = coordinator.execute(request).await.unwrap();

            assert!(response.success, "({tests:?}), stderr: {}", response.stderr,);
            assert_contains!(response.stderr, expected);

            coordinator.shutdown().await?;

            Ok(())
        });

        try_join_all(tests).with_timeout().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn execute_backtrace() -> Result<()> {
        let code = r#"fn main() { panic!("Disco"); }"#;

        let params = [
            (false, "note: run with `RUST_BACKTRACE=1`"),
            (true, "stack backtrace:"),
        ];

        let tests = params.into_iter().map(|(backtrace, expected)| async move {
            let coordinator = new_coordinator().await;

            let request = ExecuteRequest {
                code: code.into(),
                backtrace,
                ..new_execute_request()
            };
            let response = coordinator.execute(request).await.unwrap();

            assert!(
                !response.success,
                "({backtrace:?}), stderr: {}",
                response.stderr,
            );
            assert_contains!(response.stderr, expected);

            coordinator.shutdown().await?;

            Ok(())
        });

        try_join_all(tests).with_timeout().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn execute_stdin() -> Result<()> {
        let coordinator = new_coordinator().await;

        let request = ExecuteRequest {
            code: r#"
                fn main() {
                    let mut input = String::new();
                    if std::io::stdin().read_line(&mut input).is_ok() {
                        println!("You entered >>>{input:?}<<<");
                    }
                }
            "#
            .into(),
            ..ARBITRARY_EXECUTE_REQUEST
        };

        let token = Default::default();
        let ActiveExecution {
            task,
            stdin_tx,
            stdout_rx,
            stderr_rx,
        } = coordinator.begin_execute(token, request).await.unwrap();

        stdin_tx.send("this is stdin\n".into()).await.unwrap();
        // Purposefully not dropping stdin_tx early -- a user might forget

        let WithOutput {
            response,
            stdout,
            stderr,
        } = WithOutput::try_absorb(task, stdout_rx, stderr_rx)
            .with_timeout()
            .await
            .unwrap();

        assert!(response.success, "{stderr}");
        assert_contains!(stdout, r#">>>"this is stdin\n"<<<"#);

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn execute_stdin_close() -> Result<()> {
        let coordinator = new_coordinator().await;

        let request = ExecuteRequest {
            code: r#"
                fn main() {
                    let mut input = String::new();
                    while let Ok(n) = std::io::stdin().read_line(&mut input) {
                        if n == 0 {
                            break;
                        }
                        println!("You entered >>>{input:?}<<<");
                        input.clear();
                    }
                }
            "#
            .into(),
            ..ARBITRARY_EXECUTE_REQUEST
        };

        let token = Default::default();
        let ActiveExecution {
            task,
            stdin_tx,
            stdout_rx,
            stderr_rx,
        } = coordinator.begin_execute(token, request).await.unwrap();

        for i in 0..3 {
            stdin_tx.send(format!("line {i}\n")).await.unwrap();
        }

        stdin_tx.send("no newline".into()).await.unwrap();
        drop(stdin_tx); // Close the stdin handle

        let WithOutput {
            response,
            stdout,
            stderr,
        } = WithOutput::try_absorb(task, stdout_rx, stderr_rx)
            .with_timeout()
            .await
            .unwrap();

        assert!(response.success, "{stderr}");
        assert_contains!(stdout, r#">>>"line 0\n"<<<"#);
        assert_contains!(stdout, r#">>>"line 1\n"<<<"#);
        assert_contains!(stdout, r#">>>"line 2\n"<<<"#);
        assert_contains!(stdout, r#">>>"no newline"<<<"#);

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn execute_kill() -> Result<()> {
        let coordinator = new_coordinator().await;

        let request = ExecuteRequest {
            code: r#"
                fn main() {
                    println!("Before");
                    loop {
                        std::thread::sleep(std::time::Duration::from_secs(1));
                    }
                    println!("After");
                }
            "#
            .into(),
            ..ARBITRARY_EXECUTE_REQUEST
        };

        let token = CancellationToken::new();
        let ActiveExecution {
            task,
            stdin_tx: _,
            mut stdout_rx,
            stderr_rx,
        } = coordinator
            .begin_execute(token.clone(), request)
            .await
            .unwrap();

        // Wait for some output before killing
        let early_stdout = stdout_rx.recv().with_timeout().await.unwrap();

        token.cancel();

        let WithOutput {
            response,
            stdout,
            stderr,
        } = WithOutput::try_absorb(task, stdout_rx, stderr_rx)
            .with_timeout()
            .await
            .unwrap();

        assert!(!response.success, "{stderr}");
        assert_contains!(response.exit_detail, "kill");

        assert_contains!(early_stdout, "Before");
        assert_not_contains!(stdout, "Before");
        assert_not_contains!(stdout, "After");

        coordinator.shutdown().await?;

        Ok(())
    }

    const HELLO_WORLD_CODE: &str = r#"fn main() { println!("Hello World!"); }"#;

    const ARBITRARY_COMPILE_REQUEST: CompileRequest = CompileRequest {
        target: CompileTarget::Mir,
        channel: Channel::Stable,
        crate_type: CrateType::Binary,
        mode: Mode::Release,
        edition: Edition::Rust2021,
        tests: false,
        backtrace: false,
        code: String::new(),
    };

    #[tokio::test]
    #[snafu::report]
    async fn compile_response() -> Result<()> {
        let coordinator = new_coordinator().await;

        let req = CompileRequest {
            code: HELLO_WORLD_CODE.into(),
            ..ARBITRARY_COMPILE_REQUEST
        };

        let response = coordinator.compile(req).with_timeout().await.unwrap();

        assert!(response.success, "stderr: {}", response.stderr);
        assert_contains!(response.stderr, "Compiling");
        assert_contains!(response.stderr, "Finished");

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn compile_streaming() -> Result<()> {
        let coordinator = new_coordinator().await;

        let req = CompileRequest {
            code: HELLO_WORLD_CODE.into(),
            ..ARBITRARY_COMPILE_REQUEST
        };

        let token = Default::default();
        let ActiveCompilation {
            task,
            stdout_rx,
            stderr_rx,
        } = coordinator.begin_compile(token, req).await.unwrap();

        let WithOutput {
            response,
            stdout: _,
            stderr,
        } = WithOutput::try_absorb(task, stdout_rx, stderr_rx)
            .await
            .unwrap();

        assert!(response.success, "stderr: {}", stderr);
        assert_contains!(stderr, "Compiling");
        assert_contains!(stderr, "Finished");

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn compile_edition() -> Result<()> {
        for edition in Edition::ALL {
            let coordinator = new_coordinator().await;

            let req = CompileRequest {
                edition,
                code: SUBTRACT_CODE.into(),
                channel: Channel::Nightly, // To allow 2024 while it is unstable
                ..ARBITRARY_HIR_REQUEST
            };

            let response = coordinator.compile(req).with_timeout().await.unwrap();

            let prelude = format!("std::prelude::rust_{}", edition.to_str());

            assert!(response.success, "stderr: {}", response.stderr);
            assert_contains!(response.code, &prelude);

            coordinator.shutdown().await?;
        }

        Ok(())
    }

    const ADD_CODE: &str = r#"#[inline(never)] pub fn add(a: u8, b: u8) -> u8 { a + b }"#;

    const ARBITRARY_ASSEMBLY_REQUEST: CompileRequest = CompileRequest {
        target: CompileTarget::Assembly(
            DEFAULT_ASSEMBLY_FLAVOR,
            DEFAULT_ASSEMBLY_DEMANGLE,
            DEFAULT_ASSEMBLY_PROCESS,
        ),
        channel: Channel::Beta,
        crate_type: CrateType::Library(LibraryType::Lib),
        mode: Mode::Release,
        edition: Edition::Rust2018,
        tests: false,
        backtrace: false,
        code: String::new(),
    };

    const DEFAULT_ASSEMBLY_FLAVOR: AssemblyFlavor = AssemblyFlavor::Intel;
    const DEFAULT_ASSEMBLY_DEMANGLE: DemangleAssembly = DemangleAssembly::Demangle;
    const DEFAULT_ASSEMBLY_PROCESS: ProcessAssembly = ProcessAssembly::Filter;

    #[tokio::test]
    #[snafu::report]
    async fn compile_assembly() -> Result<()> {
        let coordinator = new_coordinator().await;

        let req = CompileRequest {
            code: ADD_CODE.into(),
            ..ARBITRARY_ASSEMBLY_REQUEST
        };

        let response = coordinator.compile(req).with_timeout().await.unwrap();

        let asm = docker_target_arch! {
            x86_64: "eax, [rsi + rdi]",
            aarch64: "w0, w1, w0",
        };

        assert!(response.success, "stderr: {}", response.stderr);
        assert_contains!(response.code, asm);

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    // Assembly flavor only makes sense when targeting x86(_64): this
    // test will always fail on aarch64.
    async fn compile_assembly_flavor() -> Result<()> {
        let cases = [
            (AssemblyFlavor::Att, "(%rsi,%rdi), %eax"),
            (AssemblyFlavor::Intel, "eax, [rsi + rdi]"),
        ];

        for (flavor, expected) in cases {
            let coordinator = new_coordinator().await;

            let req = CompileRequest {
                target: CompileTarget::Assembly(
                    flavor,
                    DEFAULT_ASSEMBLY_DEMANGLE,
                    DEFAULT_ASSEMBLY_PROCESS,
                ),
                code: ADD_CODE.into(),
                ..ARBITRARY_ASSEMBLY_REQUEST
            };

            let response = coordinator.compile(req).with_timeout().await.unwrap();

            assert!(response.success, "stderr: {}", response.stderr);
            assert_contains!(response.code, expected);

            coordinator.shutdown().await?;
        }
        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    // The demangling expects Linux-style symbols, not macOS: this
    // test will always fail on macOS.
    async fn compile_assembly_demangle() -> Result<()> {
        let cases = [
            (DemangleAssembly::Mangle, "10playground3add"),
            (DemangleAssembly::Demangle, "playground::add"),
        ];

        for (mangle, expected) in cases {
            let coordinator = new_coordinator().await;

            let req = CompileRequest {
                target: CompileTarget::Assembly(
                    DEFAULT_ASSEMBLY_FLAVOR,
                    mangle,
                    DEFAULT_ASSEMBLY_PROCESS,
                ),
                code: ADD_CODE.into(),
                ..ARBITRARY_ASSEMBLY_REQUEST
            };

            let response = coordinator.compile(req).with_timeout().await.unwrap();

            assert!(response.success, "stderr: {}", response.stderr);
            assert_contains!(response.code, expected);

            coordinator.shutdown().await?;
        }

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn compile_assembly_process() -> Result<()> {
        let cases = [
            (ProcessAssembly::Raw, true),
            (ProcessAssembly::Filter, false),
        ];

        for (process, expected) in cases {
            let coordinator = new_coordinator().await;

            let req = CompileRequest {
                target: CompileTarget::Assembly(
                    DEFAULT_ASSEMBLY_FLAVOR,
                    DEFAULT_ASSEMBLY_DEMANGLE,
                    process,
                ),
                code: ADD_CODE.into(),
                ..ARBITRARY_ASSEMBLY_REQUEST
            };

            let response = coordinator.compile(req).with_timeout().await.unwrap();

            assert!(response.success, "stderr: {}", response.stderr);
            if expected {
                assert_contains!(response.code, ".cfi_startproc");
            } else {
                assert_not_contains!(response.code, ".cfi_startproc");
            }

            coordinator.shutdown().await?;
        }

        Ok(())
    }

    const SUBTRACT_CODE: &str = r#"pub fn sub(a: u8, b: u8) -> u8 { a - b }"#;

    const ARBITRARY_HIR_REQUEST: CompileRequest = CompileRequest {
        target: CompileTarget::Hir,
        channel: Channel::Nightly,
        crate_type: CrateType::Library(LibraryType::Lib),
        mode: Mode::Release,
        edition: Edition::Rust2021,
        tests: false,
        backtrace: false,
        code: String::new(),
    };

    #[tokio::test]
    #[snafu::report]
    async fn compile_hir() -> Result<()> {
        let coordinator = new_coordinator().await;

        let req = CompileRequest {
            code: SUBTRACT_CODE.into(),
            ..ARBITRARY_HIR_REQUEST
        };

        let response = coordinator.compile(req).with_timeout().await.unwrap();

        assert!(response.success, "stderr: {}", response.stderr);
        assert_contains!(response.code, "extern crate std");

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn compile_llvm_ir() -> Result<()> {
        let coordinator = new_coordinator().await;

        let req = CompileRequest {
            target: CompileTarget::LlvmIr,
            channel: Channel::Stable,
            crate_type: CrateType::Library(LibraryType::Lib),
            mode: Mode::Debug,
            edition: Edition::Rust2015,
            tests: false,
            backtrace: false,
            code: r#"pub fn mul(a: u8, b: u8) -> u8 { a * b }"#.into(),
        };

        let response = coordinator.compile(req).with_timeout().await.unwrap();

        assert!(response.success, "stderr: {}", response.stderr);
        assert_contains!(response.code, "@llvm.umul.with.overflow.i8(i8, i8)");

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn compile_wasm() -> Result<()> {
        // cargo-wasm only exists inside the container
        let coordinator = new_coordinator_docker().await;

        let req = CompileRequest {
            target: CompileTarget::Wasm,
            channel: Channel::Nightly,
            crate_type: CrateType::Library(LibraryType::Cdylib),
            mode: Mode::Release,
            edition: Edition::Rust2021,
            tests: false,
            backtrace: false,
            code: r#"#[export_name = "inc"] pub fn inc(a: u8) -> u8 { a + 1 }"#.into(),
        };

        let response = coordinator.compile(req).with_timeout().await.unwrap();

        assert!(response.success, "stderr: {}", response.stderr);
        assert_contains!(
            response.code,
            r#"(func $inc (;0;) (type 0) (param i32) (result i32)"#
        );

        coordinator.shutdown().await?;

        Ok(())
    }

    const ARBITRARY_FORMAT_REQUEST: FormatRequest = FormatRequest {
        channel: Channel::Stable,
        crate_type: CrateType::Binary,
        edition: Edition::Rust2015,
        code: String::new(),
    };

    const ARBITRARY_FORMAT_INPUT: &str = "fn main(){1+1;}";
    #[rustfmt::skip]
    const ARBITRARY_FORMAT_OUTPUT: &[&str] = &[
        "fn main() {",
        "    1 + 1;",
        "}"
    ];

    #[tokio::test]
    #[snafu::report]
    async fn format() -> Result<()> {
        let coordinator = new_coordinator().await;

        let req = FormatRequest {
            code: ARBITRARY_FORMAT_INPUT.into(),
            ..ARBITRARY_FORMAT_REQUEST
        };

        let response = coordinator.format(req).with_timeout().await.unwrap();

        assert!(response.success, "stderr: {}", response.stderr);
        let lines = response.code.lines().collect::<Vec<_>>();
        assert_eq!(ARBITRARY_FORMAT_OUTPUT, lines);

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn format_channel() -> Result<()> {
        for channel in Channel::ALL {
            let coordinator = new_coordinator().await;

            let req = FormatRequest {
                channel,
                code: ARBITRARY_FORMAT_INPUT.into(),
                ..ARBITRARY_FORMAT_REQUEST
            };

            let response = coordinator.format(req).with_timeout().await.unwrap();

            assert!(response.success, "stderr: {}", response.stderr);
            let lines = response.code.lines().collect::<Vec<_>>();
            assert_eq!(ARBITRARY_FORMAT_OUTPUT, lines);
        }

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn format_edition() -> Result<()> {
        let cases = [
            ("fn main() { async { 1 } }", [false, true, true, true]),
            ("fn main() { gen { 1 } }", [false, false, false, true]),
        ];

        for (code, works_in) in cases {
            let coordinator = new_coordinator().await;

            for (edition, works) in Edition::ALL.into_iter().zip(works_in) {
                let req = FormatRequest {
                    edition,
                    code: code.into(),
                    channel: Channel::Nightly, // To allow 2024 while it is unstable
                    ..ARBITRARY_FORMAT_REQUEST
                };

                let response = coordinator.format(req).with_timeout().await.unwrap();

                assert_eq!(response.success, works, "{code} in {edition:?}");
            }
        }

        Ok(())
    }

    const ARBITRARY_CLIPPY_REQUEST: ClippyRequest = ClippyRequest {
        channel: Channel::Stable,
        crate_type: CrateType::Library(LibraryType::Rlib),
        edition: Edition::Rust2021,
        code: String::new(),
    };

    #[tokio::test]
    #[snafu::report]
    async fn clippy() -> Result<()> {
        let coordinator = new_coordinator().await;

        let req = ClippyRequest {
            code: r#"
                fn main() {
                    let a = 0.0 / 0.0;
                    println!("NaN is {}", a);
                }
                "#
            .into(),
            ..ARBITRARY_CLIPPY_REQUEST
        };

        let response = coordinator.clippy(req).with_timeout().await.unwrap();

        assert!(!response.success, "stderr: {}", response.stderr);
        assert_contains!(response.stderr, "deny(clippy::eq_op)");
        assert_contains!(response.stderr, "warn(clippy::zero_divided_by_zero)");

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn clippy_edition() -> Result<()> {
        let cases = [(
            "#![deny(clippy::single_element_loop)]
              fn a() { for i in [1] { dbg!(i); } }",
            [true, true, false, false],
        )];

        let tests = cases.into_iter().flat_map(|(code, expected_to_be_clean)| {
            Edition::ALL.into_iter().zip(expected_to_be_clean).map(
                move |(edition, expected_to_be_clean)| async move {
                    let coordinator = new_coordinator().await;

                    let req = ClippyRequest {
                        edition,
                        code: code.into(),
                        ..ARBITRARY_CLIPPY_REQUEST
                    };

                    let response = coordinator.clippy(req).with_timeout().await.unwrap();

                    assert_eq!(
                        response.success, expected_to_be_clean,
                        "{code:?} in {edition:?}, {}",
                        response.stderr
                    );

                    Ok(())
                },
            )
        });

        try_join_all(tests).with_timeout().await?;

        Ok(())
    }

    // The next set of tests are broader than the functionality of a
    // single operation.

    #[tokio::test]
    #[snafu::report]
    async fn compile_clears_old_main_rs() -> Result<()> {
        let coordinator = new_coordinator().await;

        // Create a main.rs file
        let req = ExecuteRequest {
            channel: Channel::Stable,
            crate_type: CrateType::Binary,
            mode: Mode::Debug,
            edition: Edition::Rust2021,
            tests: false,
            backtrace: false,
            code: "pub fn alpha() {}".into(),
        };

        let response = coordinator
            .execute(req.clone())
            .with_timeout()
            .await
            .unwrap();
        assert!(!response.success, "stderr: {}", response.stderr);
        assert_contains!(response.stderr, "`main` function not found");

        // Create a lib.rs file
        let req = CompileRequest {
            target: CompileTarget::LlvmIr,
            channel: req.channel,
            mode: req.mode,
            edition: req.edition,
            crate_type: CrateType::Library(LibraryType::Rlib),
            tests: req.tests,
            backtrace: req.backtrace,
            code: "pub fn beta() {}".into(),
        };

        let response = coordinator
            .compile(req.clone())
            .with_timeout()
            .await
            .unwrap();
        assert!(response.success, "stderr: {}", response.stderr);

        assert_not_contains!(response.code, "alpha");
        assert_contains!(response.code, "beta");

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn still_usable_after_idle() -> Result<()> {
        let mut coordinator = new_coordinator().await;

        let req = ExecuteRequest {
            channel: Channel::Stable,
            mode: Mode::Debug,
            edition: Edition::Rust2021,
            crate_type: CrateType::Binary,
            tests: false,
            backtrace: false,
            code: r#"fn main() { println!("hello") }"#.into(),
        };

        let res = coordinator.execute(req.clone()).await.unwrap();
        assert_eq!(res.stdout, "hello\n");

        coordinator.idle().await.unwrap();

        let res = coordinator.execute(req).await.unwrap();
        assert_eq!(res.stdout, "hello\n");

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn exit_due_to_signal_is_reported() -> Result<()> {
        let coordinator = new_coordinator().await;

        let req = ExecuteRequest {
            channel: Channel::Stable,
            mode: Mode::Release,
            edition: Edition::Rust2021,
            crate_type: CrateType::Binary,
            tests: false,
            backtrace: false,
            code: r#"fn main() { std::process::abort(); }"#.into(),
        };

        let res = coordinator.execute(req.clone()).await.unwrap();

        assert!(!res.success);
        assert_contains!(res.exit_detail, "abort");

        coordinator.shutdown().await?;

        Ok(())
    }

    fn new_execution_limited_request() -> ExecuteRequest {
        ExecuteRequest {
            channel: Channel::Stable,
            mode: Mode::Debug,
            edition: Edition::Rust2021,
            crate_type: CrateType::Binary,
            tests: false,
            backtrace: false,
            code: Default::default(),
        }
    }

    #[tokio::test]
    #[snafu::report]
    async fn network_connections_are_disabled() -> Result<()> {
        // The limits are only applied to the container
        let coordinator = new_coordinator_docker().await;

        let req = ExecuteRequest {
            code: r#"
                fn main() {
                    match ::std::net::TcpStream::connect("google.com:80") {
                        Ok(_) => println!("Able to connect to the outside world"),
                        Err(e) => println!("Failed to connect {}, {:?}", e, e),
                    }
                }
            "#
            .into(),
            ..new_execution_limited_request()
        };

        let res = coordinator.execute(req).with_timeout().await.unwrap();

        assert_contains!(res.stdout, "Failed to connect");

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn memory_usage_is_limited() -> Result<()> {
        // The limits are only applied to the container
        let coordinator = new_coordinator_docker().await;

        let req = ExecuteRequest {
            code: r#"
                fn main() {
                    let gigabyte = 1024 * 1024 * 1024;
                    let mut big = vec![0u8; 1 * gigabyte];
                    for i in &mut big { *i += 1; }
                }
            "#
            .into(),
            ..new_execution_limited_request()
        };

        let res = coordinator.execute(req).with_timeout().await.unwrap();

        assert!(!res.success);
        // TODO: We need to actually inform the user about this somehow. The UI is blank.
        // assert_contains!(res.stdout, "Killed");

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn number_of_pids_is_limited() -> Result<()> {
        // The limits are only applied to the container
        let coordinator = new_coordinator_docker().await;

        let req = ExecuteRequest {
            code: r##"
                fn main() {
                    ::std::process::Command::new("sh").arg("-c").arg(r#"
                        z() {
                            z&
                            z
                        }
                        z
                    "#).status().unwrap();
                }
            "##
            .into(),
            ..new_execution_limited_request()
        };

        let res = coordinator.execute(req).with_timeout().await.unwrap();

        assert_contains!(res.stderr, "Cannot fork");

        Ok(())
    }

    static TIMEOUT: Lazy<Duration> = Lazy::new(|| {
        let millis = env::var("TESTS_TIMEOUT_MS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(5000);
        Duration::from_millis(millis)
    });

    trait TimeoutExt: Future + Sized {
        #[allow(clippy::type_complexity)]
        fn with_timeout(
            self,
        ) -> futures::future::Map<
            tokio::time::Timeout<Self>,
            fn(Result<Self::Output, tokio::time::error::Elapsed>) -> Self::Output,
        > {
            tokio::time::timeout(*TIMEOUT, self).map(|v| v.expect("The operation timed out"))
        }
    }

    impl<F: Future> TimeoutExt for F {}
}
