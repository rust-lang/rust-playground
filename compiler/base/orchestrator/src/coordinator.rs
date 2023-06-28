use futures::{future::BoxFuture, Future, FutureExt};
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
    sync::{mpsc, oneshot},
    task::{JoinHandle, JoinSet},
    time::{self, MissedTickBehavior},
};
use tokio_stream::{wrappers::ReceiverStream, StreamExt};
use tokio_util::{io::SyncIoBridge, sync::CancellationToken};

use crate::{
    bincode_input_closed,
    message::{
        CoordinatorMessage, ExecuteCommandRequest, JobId, Multiplexed, OneToOneResponse,
        ReadFileRequest, ReadFileResponse, SerializedError, WorkerMessage, WriteFileRequest,
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
}

impl Edition {
    #[cfg(test)]
    pub(crate) const ALL: [Self; 3] = [Self::Rust2015, Self::Rust2018, Self::Rust2021];

    pub(crate) fn to_str(self) -> &'static str {
        match self {
            Edition::Rust2015 => "2015",
            Edition::Rust2018 => "2018",
            Edition::Rust2021 => "2021",
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
    pub(crate) fn is_binary(self) -> bool {
        self == CrateType::Binary
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
    pub code: String,
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
    let path = if crate_type.is_binary() {
        "src/main.rs"
    } else {
        "src/lib.rs"
    };

    WriteFileRequest {
        path: path.to_owned(),
        content: code.clone().into(),
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
    stable: Container,
    beta: Container,
    nightly: Container,
    token: CancellationToken,
}

impl<B> Coordinator<B>
where
    B: Backend,
{
    pub async fn new(backend: B) -> Result<Self, Error> {
        let token = CancellationToken::new();

        let [stable, beta, nightly] =
            Channel::ALL.map(|channel| Container::new(channel, token.clone(), &backend));

        let (stable, beta, nightly) = join!(stable, beta, nightly);

        let stable = stable?;
        let beta = beta?;
        let nightly = nightly?;

        Ok(Self {
            backend,
            stable,
            beta,
            nightly,
            token,
        })
    }

    pub async fn compile(
        &self,
        request: CompileRequest,
    ) -> Result<WithOutput<CompileResponse>, CompileError> {
        self.select_channel(request.channel).compile(request).await
    }

    pub async fn begin_compile(
        &self,
        request: CompileRequest,
    ) -> Result<ActiveCompilation, CompileError> {
        self.select_channel(request.channel)
            .begin_compile(request)
            .await
    }

    pub async fn shutdown(self) -> Result<B> {
        let Self {
            backend,
            stable,
            beta,
            nightly,
            token,
        } = self;
        token.cancel();

        let (stable, beta, nightly) = join!(stable.shutdown(), beta.shutdown(), nightly.shutdown());

        stable?;
        beta?;
        nightly?;

        Ok(backend)
    }

    fn select_channel(&self, channel: Channel) -> &Container {
        match channel {
            Channel::Stable => &self.stable,
            Channel::Beta => &self.beta,
            Channel::Nightly => &self.nightly,
        }
    }
}

impl Coordinator<DockerBackend> {
    pub async fn new_docker() -> Result<Self, Error> {
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
        let demultiplex_task = tokio::spawn(Commander::demultiplex(command_rx, from_worker_rx));

        let task = tokio::spawn(async move {
            let (c, d, t) = join!(child.wait(), demultiplex_task, tasks.join_next());
            c.context(JoinWorkerSnafu)?;
            d.context(DemultiplexerTaskPanickedSnafu)?
                .context(DemultiplexerTaskFailedSnafu)?;
            if let Some(t) = t {
                t.context(IoQueuePanickedSnafu)??;
            }

            Ok(())
        });

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

    async fn compile(
        &self,
        request: CompileRequest,
    ) -> Result<WithOutput<CompileResponse>, CompileError> {
        let ActiveCompilation {
            task,
            stdout_rx,
            stderr_rx,
        } = self.begin_compile(request).await?;

        WithOutput::try_absorb(task, stdout_rx, stderr_rx).await
    }

    async fn begin_compile(
        &self,
        request: CompileRequest,
    ) -> Result<ActiveCompilation, CompileError> {
        use compile_error::*;

        let output_path: &str = "compilation";

        let write_main = request.write_main_request();
        let execute_cargo = request.execute_cargo_request(output_path);
        let read_output = ReadFileRequest {
            path: output_path.to_owned(),
        };

        let write_main = self.commander.one(write_main);
        let modify_cargo_toml = self.modify_cargo_toml.modify_for(&request);

        let (write_main, modify_cargo_toml) = join!(write_main, modify_cargo_toml);

        write_main.context(CouldNotWriteCodeSnafu)?;
        modify_cargo_toml.context(CouldNotModifyCargoTomlSnafu)?;

        let SpawnCargo {
            task,
            stdout_rx,
            stderr_rx,
        } = self
            .spawn_cargo_task(execute_cargo)
            .await
            .context(CouldNotStartCargoSnafu)?;

        let commander = self.commander.clone();
        let task = async move {
            let success = task
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

            Ok(CompileResponse { success, code })
        }
        .boxed();

        Ok(ActiveCompilation {
            task,
            stdout_rx,
            stderr_rx,
        })
    }

    async fn spawn_cargo_task(
        &self,
        execute_cargo: ExecuteCommandRequest,
    ) -> Result<SpawnCargo, SpawnCargoError> {
        use spawn_cargo_error::*;

        let (stdout_tx, stdout_rx) = mpsc::channel(8);
        let (stderr_tx, stderr_rx) = mpsc::channel(8);

        let mut from_worker_rx = self
            .commander
            .many(execute_cargo)
            .await
            .context(CouldNotStartCargoSnafu)?;

        let task = tokio::spawn({
            async move {
                while let Some(container_msg) = from_worker_rx.recv().await {
                    match container_msg {
                        WorkerMessage::ExecuteCommand(resp) => {
                            return Ok(resp.success);
                        }
                        WorkerMessage::StdoutPacket(packet) => {
                            stdout_tx.send(packet).await.ok(/* Receiver gone, that's OK */);
                        }
                        WorkerMessage::StderrPacket(packet) => {
                            stderr_tx.send(packet).await.ok(/* Receiver gone, that's OK */);
                        }
                        _ => return UnexpectedMessageSnafu.fail(),
                    }
                }

                UnexpectedEndOfMessagesSnafu.fail()
            }
        });

        Ok(SpawnCargo {
            task,
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
    #[snafu(display("Could not modify Cargo.toml"))]
    CouldNotModifyCargoToml { source: ModifyCargoTomlError },

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

struct SpawnCargo {
    task: JoinHandle<Result<bool, SpawnCargoError>>,
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
    const PATH: &str = "Cargo.toml";

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

impl Commander {
    const GC_PERIOD: Duration = Duration::from_secs(30);

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
                            let old = waiting.insert(job_id, waiter);
                            ensure!(old.is_none(), DuplicateDemultiplexerClientSnafu { job_id });
                        }

                        DemultiplexCommand::ListenOnce(job_id, waiter) => {
                            let old = waiting_once.insert(job_id, waiter);
                            ensure!(old.is_none(), DuplicateDemultiplexerClientSnafu { job_id });
                        }
                    }

                    ack_tx.send(()).ok(/* Don't care about it */);
                },

                msg = from_worker_rx.recv() => {
                    let Some(Multiplexed(job_id, msg)) = msg else { break };

                    if let Some(waiter) = waiting_once.remove(&job_id) {
                        waiter.send(msg).ok(/* Don't care about it */);
                        continue;
                    }

                    if let Some(waiter) = waiting.get(&job_id) {
                        waiter.send(msg).await.ok(/* Don't care about it */);
                        continue;
                    }

                    // Should we log messages that didn't have a receiver?
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

    async fn send_to_worker(
        &self,
        message: Multiplexed<CoordinatorMessage>,
    ) -> Result<(), CommanderError> {
        use commander_error::*;

        self.to_worker_tx
            .send(message)
            .await
            .drop_error_details()
            .context(UnableToSendToWorkerSnafu)
    }

    async fn one<M>(&self, message: M) -> Result<M::Response, CommanderError>
    where
        M: Into<CoordinatorMessage>,
        M: OneToOneResponse,
        Result<M::Response, SerializedError>: TryFrom<WorkerMessage>,
    {
        use commander_error::*;

        let id = self.next_id();
        let (from_demultiplexer_tx, from_demultiplexer_rx) = oneshot::channel();

        self.send_to_demultiplexer(DemultiplexCommand::ListenOnce(id, from_demultiplexer_tx))
            .await?;
        self.send_to_worker(Multiplexed(id, message.into())).await?;
        let msg = from_demultiplexer_rx
            .await
            .context(UnableToReceiveFromDemultiplexerSnafu)?;

        match msg.try_into() {
            Ok(Ok(v)) => Ok(v),
            Ok(Err(e)) => WorkerOperationFailedSnafu { text: e.0 }.fail(),
            Err(_) => UnexpectedResponseTypeSnafu.fail(),
        }
    }

    async fn many<M>(&self, message: M) -> Result<mpsc::Receiver<WorkerMessage>, CommanderError>
    where
        M: Into<CoordinatorMessage>,
    {
        let id = self.next_id();
        let (from_worker_tx, from_worker_rx) = mpsc::channel(8);

        self.send_to_demultiplexer(DemultiplexCommand::Listen(id, from_worker_tx))
            .await?;
        self.send_to_worker(Multiplexed(id, message.into())).await?;

        Ok(from_worker_rx)
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

    #[snafu(display("Could not send a message to the worker"))]
    UnableToSendToWorker { source: mpsc::error::SendError<()> },

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

#[cfg(target_arch = "x86_64")]
const DOCKER_ARCH: &str = "linux/amd64";

#[cfg(target_arch = "aarch64")]
const DOCKER_ARCH: &str = "linux/arm64";

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

            let Some(coordinator_msg) = coordinator_msg else { break };

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
    use futures::{Future, FutureExt};
    use std::{sync::Once, time::Duration};
    use tempdir::TempDir;
    use tokio::join;
    use tokio_stream::{wrappers::ReceiverStream, StreamExt};

    use super::*;

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

            let output = std::process::Command::new("cargo")
                .arg("init")
                .args(["--name", "playground"])
                .arg(project_dir.path())
                .output()
                .expect("Build failed");
            assert!(output.status.success(), "Cargo initialization failed");

            let main = project_dir.path().join("src").join("main.rs");
            std::fs::remove_file(main).expect("Could not delete main.rs");

            Self { project_dir }
        }
    }

    impl Backend for TestBackend {
        fn prepare_worker_command(&self, channel: Channel) -> Command {
            let toolchain_file = format!(r#"[toolchain]\nchannel = "{}""#, channel.to_str());
            let path = self.project_dir.path().join("rust-toolchain.toml");
            std::fs::write(path, toolchain_file).expect("Couldn't write toolchain file");

            let mut command = Command::new("./target/debug/worker");
            command.arg(self.project_dir.path());
            command
        }
    }

    async fn new_coordinator() -> Result<Coordinator<impl Backend>> {
        Coordinator::new(TestBackend::new()).await
        //Coordinator::new_docker().await
    }

    fn new_compile_request() -> CompileRequest {
        new_compile_mir_request()
    }

    fn new_compile_assembly_request() -> CompileRequest {
        CompileRequest {
            target: CompileTarget::Assembly(
                AssemblyFlavor::Intel,
                DemangleAssembly::Demangle,
                ProcessAssembly::Filter,
            ),
            channel: Channel::Beta,
            crate_type: CrateType::Library(LibraryType::Lib),
            mode: Mode::Release,
            edition: Edition::Rust2018,
            tests: false,
            backtrace: false,
            code: r#"pub fn add(a: u8, b: u8) -> u8 { a + b }"#.to_owned(),
        }
    }

    fn new_compile_hir_request() -> CompileRequest {
        new_compile_hir_request_for(Edition::Rust2021)
    }

    fn new_compile_hir_request_for(edition: Edition) -> CompileRequest {
        CompileRequest {
            target: CompileTarget::Hir,
            channel: Channel::Nightly,
            crate_type: CrateType::Library(LibraryType::Lib),
            mode: Mode::Release,
            edition,
            tests: false,
            backtrace: false,
            code: r#"pub fn sub(a: u8, b: u8) -> u8 { a - b }"#.to_owned(),
        }
    }

    fn new_compile_llvm_ir_request() -> CompileRequest {
        CompileRequest {
            target: CompileTarget::LlvmIr,
            channel: Channel::Stable,
            crate_type: CrateType::Library(LibraryType::Lib),
            mode: Mode::Debug,
            edition: Edition::Rust2015,
            tests: false,
            backtrace: false,
            code: r#"pub fn mul(a: u8, b: u8) -> u8 { a * b }"#.to_owned(),
        }
    }

    fn new_compile_mir_request() -> CompileRequest {
        CompileRequest {
            target: CompileTarget::Mir,
            channel: Channel::Stable,
            crate_type: CrateType::Binary,
            mode: Mode::Release,
            edition: Edition::Rust2021,
            tests: false,
            backtrace: false,
            code: r#"fn main() { println!("Hello World!"); }"#.to_owned(),
        }
    }

    fn new_compile_wasm_request() -> CompileRequest {
        CompileRequest {
            target: CompileTarget::Wasm,
            channel: Channel::Nightly, // TODO: Can we run this on all channels now?
            crate_type: CrateType::Library(LibraryType::Cdylib),
            mode: Mode::Release,
            edition: Edition::Rust2021,
            tests: false,
            backtrace: false,
            code: r#"#[export_name = "inc"] pub fn inc(a: u8) -> u8 { a + 1 }"#.to_owned(),
        }
    }

    #[tokio::test]
    #[snafu::report]
    async fn test_compile_response() -> Result<()> {
        let coordinator = new_coordinator().await?;

        let response = coordinator
            .compile(new_compile_request())
            .with_timeout()
            .await
            .unwrap();

        assert!(response.success, "stderr: {}", response.stderr);
        assert_contains!(response.stderr, "Compiling");
        assert_contains!(response.stderr, "Finished");

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn test_compile_streaming() -> Result<()> {
        let coordinator = new_coordinator().await?;

        let ActiveCompilation {
            task,
            stdout_rx,
            stderr_rx,
        } = coordinator
            .begin_compile(new_compile_request())
            .await
            .unwrap();

        let stdout = ReceiverStream::new(stdout_rx);
        let stdout = stdout.collect::<String>();

        let stderr = ReceiverStream::new(stderr_rx);
        let stderr = stderr.collect::<String>();

        let (complete, _stdout, stderr) =
            async { join!(task, stdout, stderr) }.with_timeout().await;

        let response = complete.unwrap();

        assert!(response.success, "stderr: {}", stderr);
        assert_contains!(stderr, "Compiling");
        assert_contains!(stderr, "Finished");

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn test_compile_edition() -> Result<()> {
        for edition in Edition::ALL {
            let coordinator = new_coordinator().await?;

            let response = coordinator
                .compile(new_compile_hir_request_for(edition))
                .with_timeout()
                .await
                .unwrap();

            let prelude = format!("std::prelude::rust_{}", edition.to_str());

            assert!(response.success, "stderr: {}", response.stderr);
            assert_contains!(response.code, &prelude);

            coordinator.shutdown().await?;
        }

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn test_compile_assembly() -> Result<()> {
        let coordinator = new_coordinator().await?;

        let response = coordinator
            .compile(new_compile_assembly_request())
            .with_timeout()
            .await
            .unwrap();

        //#[cfg(target_arch = "x86_64")]
        //let asm = "";

        #[cfg(target_arch = "aarch64")]
        let asm = "w0, w1, w0";

        assert!(response.success, "stderr: {}", response.stderr);
        assert_contains!(response.code, asm);

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn test_compile_hir() -> Result<()> {
        let coordinator = new_coordinator().await?;

        let response = coordinator
            .compile(new_compile_hir_request())
            .with_timeout()
            .await
            .unwrap();

        assert!(response.success, "stderr: {}", response.stderr);
        assert_contains!(response.code, "extern crate std");

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn test_compile_llvm_ir() -> Result<()> {
        let coordinator = new_coordinator().await?;

        let response = coordinator
            .compile(new_compile_llvm_ir_request())
            .with_timeout()
            .await
            .unwrap();

        assert!(response.success, "stderr: {}", response.stderr);
        assert_contains!(response.code, "@llvm.umul.with.overflow.i8(i8, i8)");

        coordinator.shutdown().await?;

        Ok(())
    }

    #[tokio::test]
    #[snafu::report]
    async fn test_compile_wasm() -> Result<()> {
        // cargo-wasm only exists inside the container
        let coordinator = Coordinator::new_docker().await?;

        let response = coordinator
            .compile(new_compile_wasm_request())
            .with_timeout()
            .await
            .unwrap();

        assert!(response.success, "stderr: {}", response.stderr);
        assert_contains!(
            response.code,
            r#"(func $inc (export "inc") (type $t0) (param $p0 i32) (result i32)"#
        );

        coordinator.shutdown().await?;

        Ok(())
    }

    trait TimeoutExt: Future + Sized {
        #[allow(clippy::type_complexity)]
        fn with_timeout(
            self,
        ) -> futures::future::Map<
            tokio::time::Timeout<Self>,
            fn(Result<Self::Output, tokio::time::error::Elapsed>) -> Self::Output,
        > {
            tokio::time::timeout(Duration::from_millis(5000), self)
                .map(|v| v.expect("The operation timed out"))
        }
    }

    impl<F: Future> TimeoutExt for F {}
}
