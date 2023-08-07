//! # Task information
//!
//! ## Hierarchy
//!
//! ```text
//! listen
//! ├── stdin
//! ├── stdout
//! ├── handle_coordinator_message
//! │   └── background (N)
//! └── manage_processes
//!     └── process (N)
//!         ├── process stdin
//!         ├── process stdout
//!         └── process stderr
//! ```
//!
//! ## Notable resources
//!
//! - stdin
//!   - [`std::io::Stdin`][]
//! - stdout
//!   - [`std::io::Stdout`][]
//! - process
//!   - [`tokio::process::Child`][]
//! - process stdin
//!   - [`tokio::process::ChildStdin`][]
//! - process stdout
//!   - [`tokio::process::ChildStdout`][]
//! - process stderr
//!   - [`tokio::process::ChildStderr`][]
//!

use snafu::prelude::*;
use std::{
    collections::HashMap,
    io,
    path::{Path, PathBuf},
    process::Stdio,
};
use tokio::{
    fs,
    io::{AsyncRead, AsyncReadExt, AsyncWriteExt},
    process::{Child, ChildStderr, ChildStdin, ChildStdout, Command},
    select,
    sync::mpsc,
    task::JoinSet,
};

use crate::{
    bincode_input_closed,
    message::{
        CoordinatorMessage, DeleteFileRequest, DeleteFileResponse, ExecuteCommandRequest,
        ExecuteCommandResponse, JobId, Multiplexed, ReadFileRequest, ReadFileResponse,
        SerializedError, WorkerMessage, WriteFileRequest, WriteFileResponse,
    },
    DropErrorDetailsExt,
};

type CommandRequest = (Multiplexed<ExecuteCommandRequest>, MultiplexingSender);

pub async fn listen(project_dir: impl Into<PathBuf>) -> Result<(), Error> {
    let project_dir = project_dir.into();

    let (coordinator_msg_tx, coordinator_msg_rx) = mpsc::channel(8);
    let (worker_msg_tx, worker_msg_rx) = mpsc::channel(8);
    let mut io_tasks = spawn_io_queue(coordinator_msg_tx, worker_msg_rx);

    let (cmd_tx, cmd_rx) = mpsc::channel(8);
    let (stdin_tx, stdin_rx) = mpsc::channel(8);
    let process_task = tokio::spawn(manage_processes(stdin_rx, cmd_rx, project_dir.clone()));

    let handler_task = tokio::spawn(handle_coordinator_message(
        coordinator_msg_rx,
        worker_msg_tx,
        project_dir,
        cmd_tx,
        stdin_tx,
    ));

    select! {
        Some(io_task) = io_tasks.join_next() => {
            io_task.context(IoTaskPanickedSnafu)?.context(IoTaskFailedSnafu)?;
        }

        process_task = process_task => {
            process_task.context(ProcessTaskPanickedSnafu)?.context(ProcessTaskFailedSnafu)?;
        }

        handler_task = handler_task => {
            handler_task.context(HandlerTaskPanickedSnafu)?.context(HandlerTaskFailedSnafu)?;
        }
    }

    Ok(())
}

#[derive(Debug, Snafu)]
pub enum Error {
    #[snafu(display("The IO queue task panicked"))]
    IoTaskPanicked { source: tokio::task::JoinError },

    #[snafu(display("The IO queue task failed"))]
    IoTaskFailed { source: IoQueueError },

    #[snafu(display("The process task panicked"))]
    ProcessTaskPanicked { source: tokio::task::JoinError },

    #[snafu(display("The process task failed"))]
    ProcessTaskFailed { source: ProcessError },

    #[snafu(display("The coordinator message handler task panicked"))]
    HandlerTaskPanicked { source: tokio::task::JoinError },

    #[snafu(display("The coordinator message handler task failed"))]
    HandlerTaskFailed {
        source: HandleCoordinatorMessageError,
    },
}

async fn handle_coordinator_message(
    mut coordinator_msg_rx: mpsc::Receiver<Multiplexed<CoordinatorMessage>>,
    worker_msg_tx: mpsc::Sender<Multiplexed<WorkerMessage>>,
    project_dir: PathBuf,
    cmd_tx: mpsc::Sender<CommandRequest>,
    stdin_tx: mpsc::Sender<Multiplexed<String>>,
) -> Result<(), HandleCoordinatorMessageError> {
    use handle_coordinator_message_error::*;

    let mut tasks = JoinSet::new();

    loop {
        select! {
            coordinator_msg = coordinator_msg_rx.recv() => {
                let Some(Multiplexed(job_id, coordinator_msg)) = coordinator_msg else { break };

                let worker_msg_tx = || MultiplexingSender {
                    job_id,
                    tx: worker_msg_tx.clone(),
                };

                match coordinator_msg {
                    CoordinatorMessage::WriteFile(req) => {
                        let project_dir = project_dir.clone();
                        let worker_msg_tx = worker_msg_tx();

                        tasks.spawn(async move {
                            worker_msg_tx
                                .send(handle_write_file(req, project_dir).await)
                                .await
                                .context(UnableToSendWriteFileResponseSnafu)
                        });
                    }

                    CoordinatorMessage::DeleteFile(req) => {
                        let project_dir = project_dir.clone();
                        let worker_msg_tx = worker_msg_tx();

                        tasks.spawn(async move {
                            worker_msg_tx
                                .send(handle_delete_file(req, project_dir).await)
                                .await
                                .context(UnableToSendDeleteFileResponseSnafu)
                        });
                    }

                    CoordinatorMessage::ReadFile(req) => {
                        let project_dir = project_dir.clone();
                        let worker_msg_tx = worker_msg_tx();

                        tasks.spawn(async move {
                            worker_msg_tx
                                .send(handle_read_file(req, project_dir).await)
                                .await
                                .context(UnableToSendReadFileResponseSnafu)
                        });
                    }

                    CoordinatorMessage::ExecuteCommand(req) => {
                        cmd_tx
                            .send((Multiplexed(job_id, req), worker_msg_tx()))
                            .await
                            .drop_error_details()
                            .context(UnableToSendCommandExecutionRequestSnafu)?;
                    }

                    CoordinatorMessage::StdinPacket(data) => {
                        stdin_tx
                            .send(Multiplexed(job_id, data))
                            .await
                            .drop_error_details()
                            .context(UnableToSendStdinPacketSnafu)?;
                    }
                }
            }

            Some(task) = tasks.join_next() => {
                task.context(TaskPanickedSnafu)??;
            }
        }
    }

    Ok(())
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum HandleCoordinatorMessageError {
    #[snafu(display("Could not send the write command response to the coordinator"))]
    UnableToSendWriteFileResponse { source: MultiplexingSenderError },

    #[snafu(display("Could not send the delete command response to the coordinator"))]
    UnableToSendDeleteFileResponse { source: MultiplexingSenderError },

    #[snafu(display("Could not send the read command response to the coordinator"))]
    UnableToSendReadFileResponse { source: MultiplexingSenderError },

    #[snafu(display("Failed to send command execution request to the command task"))]
    UnableToSendCommandExecutionRequest { source: mpsc::error::SendError<()> },

    #[snafu(display("Failed to send stdin packet to the command task"))]
    UnableToSendStdinPacket { source: mpsc::error::SendError<()> },

    #[snafu(display("A coordinator command handler background task panicked"))]
    TaskPanicked { source: tokio::task::JoinError },
}

#[derive(Debug, Clone)]
struct MultiplexingSender {
    job_id: JobId,
    tx: mpsc::Sender<Multiplexed<WorkerMessage>>,
}

impl MultiplexingSender {
    async fn send(
        &self,
        message: Result<impl Into<WorkerMessage>, impl std::error::Error>,
    ) -> Result<(), MultiplexingSenderError> {
        match message {
            Ok(v) => self.send_ok(v).await,
            Err(e) => self.send_err(e).await,
        }
    }

    async fn send_ok(
        &self,
        message: impl Into<WorkerMessage>,
    ) -> Result<(), MultiplexingSenderError> {
        self.send_raw(message.into()).await
    }

    async fn send_err(&self, e: impl std::error::Error) -> Result<(), MultiplexingSenderError> {
        self.send_raw(WorkerMessage::Error(SerializedError::new(e)))
            .await
    }

    async fn send_raw(&self, message: WorkerMessage) -> Result<(), MultiplexingSenderError> {
        use multiplexing_sender_error::*;

        self.tx
            .send(Multiplexed(self.job_id, message))
            .await
            .drop_error_details()
            .context(UnableToSendWorkerMessageSnafu)
    }
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum MultiplexingSenderError {
    #[snafu(display("Failed to send worker message to the serialization task"))]
    UnableToSendWorkerMessage { source: mpsc::error::SendError<()> },
}

async fn handle_write_file(
    req: WriteFileRequest,
    project_dir: PathBuf,
) -> Result<WriteFileResponse, WriteFileError> {
    use write_file_error::*;

    let path = parse_working_dir(Some(req.path), project_dir);

    // Create intermediate directories.
    if let Some(parent_dir) = path.parent() {
        fs::create_dir_all(parent_dir)
            .await
            .context(UnableToCreateDirSnafu { parent_dir })?;
    }

    fs::write(&path, req.content)
        .await
        .context(UnableToWriteFileSnafu { path })?;

    Ok(WriteFileResponse(()))
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum WriteFileError {
    #[snafu(display("Failed to create parent directory {}", parent_dir.display()))]
    UnableToCreateDir {
        source: std::io::Error,
        parent_dir: PathBuf,
    },

    #[snafu(display("Failed to write file {}", path.display()))]
    UnableToWriteFile {
        source: std::io::Error,
        path: PathBuf,
    },
}

async fn handle_delete_file(
    req: DeleteFileRequest,
    project_dir: PathBuf,
) -> Result<DeleteFileResponse, DeleteFileError> {
    use delete_file_error::*;

    let path = parse_working_dir(Some(req.path), project_dir);

    let r = match fs::remove_file(&path).await {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e),
    };

    r.context(UnableToDeleteFileSnafu { path })?;
    Ok(DeleteFileResponse(()))
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum DeleteFileError {
    #[snafu(display("Failed to delete file {}", path.display()))]
    UnableToDeleteFile {
        source: std::io::Error,
        path: PathBuf,
    },
}

async fn handle_read_file(
    req: ReadFileRequest,
    project_dir: PathBuf,
) -> Result<ReadFileResponse, ReadFileError> {
    use read_file_error::*;

    let path = parse_working_dir(Some(req.path), project_dir);

    let content = fs::read(&path)
        .await
        .context(UnableToReadFileSnafu { path })?;

    Ok(ReadFileResponse(content))
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum ReadFileError {
    #[snafu(display("Failed to read file {}", path.display()))]
    UnableToReadFile {
        source: std::io::Error,
        path: PathBuf,
    },
}

// Current working directory defaults to project dir unless specified otherwise.
fn parse_working_dir(cwd: Option<String>, project_path: impl Into<PathBuf>) -> PathBuf {
    let mut final_path = project_path.into();
    if let Some(path) = cwd {
        // Absolute path will replace final_path.
        final_path.push(path)
    }
    final_path
}

async fn manage_processes(
    mut stdin_rx: mpsc::Receiver<Multiplexed<String>>,
    mut cmd_rx: mpsc::Receiver<CommandRequest>,
    project_path: PathBuf,
) -> Result<(), ProcessError> {
    use process_error::*;

    let mut processes = JoinSet::new();
    let mut stdin_senders = HashMap::new();
    let (stdin_shutdown_tx, mut stdin_shutdown_rx) = mpsc::channel(8);

    loop {
        select! {
            cmd_req = cmd_rx.recv() => {
                let Some((Multiplexed(job_id, req), worker_msg_tx)) = cmd_req else { break };

                let RunningChild { child, stdin_rx, stdin, stdout, stderr } = match process_begin(req, &project_path, &mut stdin_senders, job_id) {
                    Ok(v) => v,
                    Err(e) => {
                        // Should we add a message for process started
                        // in addition to the current message which
                        // indicates that the process has ended?
                        worker_msg_tx.send_err(e).await.context(UnableToSendExecuteCommandStartedResponseSnafu)?;
                        continue;
                    }
                };

                let task_set = stream_stdio(worker_msg_tx.clone(), stdin_rx, stdin, stdout, stderr);

                processes.spawn({
                    let stdin_shutdown_tx = stdin_shutdown_tx.clone();
                    async move {
                        worker_msg_tx
                            .send(process_end(child, task_set, stdin_shutdown_tx, job_id).await)
                            .await
                            .context(UnableToSendExecuteCommandResponseSnafu)
                    }
                });
            }

            stdin_packet = stdin_rx.recv() => {
                // Dispatch stdin packet to different child by attached command id.
                let Some(Multiplexed(job_id, packet)) = stdin_packet else { break };

                if let Some(stdin_tx) = stdin_senders.get(&job_id) {
                    stdin_tx.send(packet).await.drop_error_details().context(UnableToSendStdinDataSnafu)?;
                }
            }

            job_id = stdin_shutdown_rx.recv() => {
                let job_id = job_id.context(StdinShutdownReceiverEndedSnafu)?;
                stdin_senders.remove(&job_id);
                // Should we care if we remove a sender that's already removed?
            }

            Some(process) = processes.join_next() => {
                process.context(ProcessTaskPanickedSnafu)??;
            }
        }
    }

    Ok(())
}

struct RunningChild {
    child: Child,
    stdin_rx: mpsc::Receiver<String>,
    stdin: ChildStdin,
    stdout: ChildStdout,
    stderr: ChildStderr,
}

fn process_begin(
    req: ExecuteCommandRequest,
    project_path: &Path,
    stdin_senders: &mut HashMap<JobId, mpsc::Sender<String>>,
    job_id: JobId,
) -> Result<RunningChild, ProcessError> {
    use process_error::*;

    let ExecuteCommandRequest {
        cmd,
        args,
        envs,
        cwd,
    } = req;
    let mut child = Command::new(&cmd)
        .args(args)
        .envs(envs)
        .current_dir(parse_working_dir(cwd, project_path))
        .kill_on_drop(true)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context(UnableToSpawnProcessSnafu { cmd })?;

    let stdin = child.stdin.take().context(UnableToCaptureStdinSnafu)?;
    let stdout = child.stdout.take().context(UnableToCaptureStdoutSnafu)?;
    let stderr = child.stderr.take().context(UnableToCaptureStderrSnafu)?;

    // Preparing for receiving stdin packet.
    let (stdin_tx, stdin_rx) = mpsc::channel(8);
    stdin_senders.insert(job_id, stdin_tx);

    Ok(RunningChild {
        child,
        stdin_rx,
        stdin,
        stdout,
        stderr,
    })
}

async fn process_end(
    mut child: Child,
    mut task_set: JoinSet<Result<(), StdioError>>,
    stdin_shutdown_tx: mpsc::Sender<JobId>,
    job_id: JobId,
) -> Result<ExecuteCommandResponse, ProcessError> {
    use process_error::*;

    let status = child.wait().await.context(WaitChildSnafu)?;

    stdin_shutdown_tx
        .send(job_id)
        .await
        .drop_error_details()
        .context(UnableToSendStdinShutdownSnafu)?;

    while let Some(task) = task_set.join_next().await {
        task.context(StdioTaskPanickedSnafu)?
            .context(StdioTaskFailedSnafu)?;
    }

    let success = status.success();
    Ok(ExecuteCommandResponse { success })
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum ProcessError {
    #[snafu(display("Failed to spawn child process {cmd}"))]
    UnableToSpawnProcess { source: std::io::Error, cmd: String },

    #[snafu(display("Failed to capture child process stdin"))]
    UnableToCaptureStdin,

    #[snafu(display("Failed to capture child process stdout"))]
    UnableToCaptureStdout,

    #[snafu(display("Failed to capture child process stderr"))]
    UnableToCaptureStderr,

    #[snafu(display("Failed to send stdin data"))]
    UnableToSendStdinData { source: mpsc::error::SendError<()> },

    #[snafu(display("Failed to wait for child process exiting"))]
    WaitChild { source: std::io::Error },

    #[snafu(display("Failed to send the stdin shutdown request"))]
    UnableToSendStdinShutdown { source: mpsc::error::SendError<()> },

    #[snafu(display("The command's stdio task panicked"))]
    StdioTaskPanicked { source: tokio::task::JoinError },

    #[snafu(display("The command's stdio task failed"))]
    StdioTaskFailed { source: StdioError },

    #[snafu(display("Failed to send the command started response to the coordinator"))]
    UnableToSendExecuteCommandStartedResponse { source: MultiplexingSenderError },

    #[snafu(display("Failed to send the command completed response to the coordinator"))]
    UnableToSendExecuteCommandResponse { source: MultiplexingSenderError },

    #[snafu(display("The stdin shutdown receiver ended prematurely"))]
    StdinShutdownReceiverEnded,

    #[snafu(display("The process task panicked"))]
    ProcessTaskPanicked { source: tokio::task::JoinError },
}

fn stream_stdio(
    coordinator_tx: MultiplexingSender,
    mut stdin_rx: mpsc::Receiver<String>,
    mut stdin: ChildStdin,
    stdout: ChildStdout,
    stderr: ChildStderr,
) -> JoinSet<Result<(), StdioError>> {
    use stdio_error::*;

    let mut set = JoinSet::new();

    set.spawn(async move {
        loop {
            let Some(data) = stdin_rx.recv().await else {
                break;
            };
            stdin
                .write_all(data.as_bytes())
                .await
                .context(UnableToWriteStdinSnafu)?;
            stdin.flush().await.context(UnableToFlushStdinSnafu)?;
        }

        Ok(())
    });

    set.spawn({
        copy_child_output(stdout, coordinator_tx.clone(), WorkerMessage::StdoutPacket)
            .context(CopyStdoutSnafu)
    });

    set.spawn({
        copy_child_output(stderr, coordinator_tx, WorkerMessage::StderrPacket)
            .context(CopyStderrSnafu)
    });

    set
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum StdioError {
    #[snafu(display("Failed to write stdin data"))]
    UnableToWriteStdin { source: std::io::Error },

    #[snafu(display("Failed to flush stdin data"))]
    UnableToFlushStdin { source: std::io::Error },

    #[snafu(display("Failed to copy child stdout"))]
    CopyStdout { source: CopyChildOutputError },

    #[snafu(display("Failed to copy child stderr"))]
    CopyStderr { source: CopyChildOutputError },
}

struct Utf8BufReader<R> {
    reader: R,
    buffer: Box<[u8]>,
    n_incomplete: usize,
}

impl<R> Utf8BufReader<R>
where
    R: AsyncRead + Unpin,
{
    const DEFAULT_CAPACITY: usize = 32 * 1024;

    fn new(reader: R) -> Self {
        Self {
            reader,
            buffer: vec![0; Self::DEFAULT_CAPACITY].into(),
            n_incomplete: 0,
        }
    }

    async fn next(&mut self) -> Result<Option<String>, Utf8BufReaderError> {
        use std::str;
        use utf8_buf_reader_error::*;

        loop {
            let after_incomplete_bytes = &mut self.buffer[self.n_incomplete..];
            let n_read = self
                .reader
                .read(after_incomplete_bytes)
                .await
                .context(ReaderSnafu)?;
            let n_valid = self.n_incomplete + n_read;

            if n_read == 0 && self.n_incomplete == 0 {
                return Ok(None);
            }

            let valid_utf_8_bytes = match str::from_utf8(&self.buffer[..n_valid]) {
                Ok(s) => s.len(),
                Err(e) => e.valid_up_to(),
            };

            // We can't parse any UTF-8
            if valid_utf_8_bytes == 0 {
                // We aren't going to get any more input
                ensure!(n_read != 0, RanOutOfInputSnafu);

                // This should be enough bytes to get one UTF-8 character.
                ensure!(n_valid < 4, InvalidUtf8Snafu)
            }

            // Safety: We just calculated the number of valid UTF-8 bytes
            // and the buffer hasn't changed since then.
            let s = unsafe {
                let utf8_bytes = self.buffer.get_unchecked(..valid_utf_8_bytes);
                str::from_utf8_unchecked(utf8_bytes)
            };
            let s = s.to_owned();

            // Move any trailing incomplete bytes
            self.buffer.copy_within(valid_utf_8_bytes..n_valid, 0);

            self.n_incomplete = n_valid - valid_utf_8_bytes;
            assert!(
                self.n_incomplete < 4,
                "Should never have 4 or more incomplete bytes, had {}",
                self.n_incomplete,
            );

            if !s.is_empty() {
                return Ok(Some(s));
            }
        }
    }
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum Utf8BufReaderError {
    Reader {
        source: std::io::Error,
    },

    #[snafu(display("Insufficient data to complete a UTF-8 character"))]
    RanOutOfInput,

    #[snafu(display("Found non-UTF-8 data"))]
    InvalidUtf8,
}

#[cfg(test)]
mod test {
    use std::{
        collections::VecDeque,
        io,
        pin::Pin,
        task::{Context, Poll},
    };

    use assert_matches::assert_matches;

    use super::*;

    struct FixedAsyncRead(VecDeque<io::Result<Vec<u8>>>);

    impl FixedAsyncRead {
        fn is_empty(&self) -> bool {
            self.0.is_empty()
        }

        fn success_exact(i: impl IntoIterator<Item = impl Into<Vec<u8>>>) -> Self {
            Self(
                i.into_iter()
                    .map(Into::into)
                    .chain(Some(vec![]))
                    .map(Ok)
                    .collect(),
            )
        }
    }

    impl AsyncRead for FixedAsyncRead {
        fn poll_read(
            self: Pin<&mut Self>,
            _cx: &mut Context<'_>,
            buf: &mut tokio::io::ReadBuf<'_>,
        ) -> Poll<io::Result<()>> {
            let this = Pin::get_mut(self);
            let next_result = this.0.pop_front().expect("FixedAsyncRead ran out of input");

            if let Ok(v) = &next_result {
                buf.put_slice(&v);
            }

            Poll::Ready(next_result.map(drop))
        }
    }

    #[tokio::test]
    async fn small_reads() {
        let bytes: [u8; 4] = "🙂".as_bytes().try_into().unwrap();

        let reader = FixedAsyncRead::success_exact(bytes.map(|b| [b]));
        let mut buffer = Utf8BufReader::new(reader);

        assert_eq!(buffer.next().await.unwrap().as_deref(), Some("🙂"));
        assert_eq!(buffer.next().await.unwrap().as_deref(), None);
        assert!(buffer.reader.is_empty());
    }

    #[tokio::test]
    async fn incomplete_utf8() {
        let bytes: [u8; 4] = "🙂".as_bytes().try_into().unwrap();

        let partial_string = &bytes[..3];
        let reader = FixedAsyncRead::success_exact([partial_string]);
        let mut buffer = Utf8BufReader::new(reader);

        assert_matches!(buffer.next().await, Err(Utf8BufReaderError::RanOutOfInput));
        assert!(buffer.reader.is_empty());
    }

    #[tokio::test]
    async fn invalid_utf8() {
        let mut bytes: [u8; 4] = "🙂".as_bytes().try_into().unwrap();
        bytes[0] = 0xFF;

        let reader = FixedAsyncRead::success_exact([bytes]);
        let mut buffer = Utf8BufReader::new(reader);

        assert_matches!(buffer.next().await, Err(Utf8BufReaderError::InvalidUtf8));
        assert!(!buffer.reader.is_empty());
    }

    #[tokio::test]
    async fn split_across_responses() {
        let bytes: [u8; 12] = "🙂🙂🙂".as_bytes().try_into().unwrap();

        let (head, tail) = bytes.split_at(6);
        let reader = FixedAsyncRead::success_exact([head, tail]);
        let mut buffer = Utf8BufReader::new(reader);

        assert_eq!(buffer.next().await.unwrap().as_deref(), Some("🙂"));
        assert_eq!(buffer.next().await.unwrap().as_deref(), Some("🙂🙂"));
        assert_eq!(buffer.next().await.unwrap().as_deref(), None);
        assert!(buffer.reader.is_empty());
    }
}

async fn copy_child_output(
    output: impl AsyncRead + Unpin,
    coordinator_tx: MultiplexingSender,
    mut xform: impl FnMut(String) -> WorkerMessage,
) -> Result<(), CopyChildOutputError> {
    use copy_child_output_error::*;

    let mut buf = Utf8BufReader::new(output);

    while let Some(buffer) = buf.next().await.context(UnableToReadSnafu)? {
        coordinator_tx
            .send_ok(xform(buffer))
            .await
            .context(UnableToSendSnafu)?;
    }

    Ok(())
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum CopyChildOutputError {
    #[snafu(display("Failed to read child output"))]
    UnableToRead { source: Utf8BufReaderError },

    #[snafu(display("Failed to send output packet"))]
    UnableToSend { source: MultiplexingSenderError },
}

// stdin/out <--> messages.
fn spawn_io_queue(
    coordinator_msg_tx: mpsc::Sender<Multiplexed<CoordinatorMessage>>,
    mut worker_msg_rx: mpsc::Receiver<Multiplexed<WorkerMessage>>,
) -> JoinSet<Result<(), IoQueueError>> {
    use io_queue_error::*;
    use std::io::{prelude::*, BufReader, BufWriter};

    let mut tasks = JoinSet::new();

    tasks.spawn_blocking(move || {
        let stdin = std::io::stdin();
        let mut stdin = BufReader::new(stdin);

        loop {
            let coordinator_msg = bincode::deserialize_from(&mut stdin);

            if bincode_input_closed(&coordinator_msg) {
                break;
            };

            let coordinator_msg =
                coordinator_msg.context(UnableToDeserializeCoordinatorMessageSnafu)?;

            coordinator_msg_tx
                .blocking_send(coordinator_msg)
                .drop_error_details()
                .context(UnableToSendCoordinatorMessageSnafu)?;
        }

        Ok(())
    });

    tasks.spawn_blocking(move || {
        let stdout = std::io::stdout();
        let mut stdout = BufWriter::new(stdout);

        loop {
            let worker_msg = worker_msg_rx
                .blocking_recv()
                .context(UnableToReceiveWorkerMessageSnafu)?;

            bincode::serialize_into(&mut stdout, &worker_msg)
                .context(UnableToSerializeWorkerMessageSnafu)?;

            stdout.flush().context(UnableToFlushStdoutSnafu)?;
        }
    });

    tasks
}

#[derive(Debug, Snafu)]
#[snafu(module)]
pub enum IoQueueError {
    #[snafu(display("Failed to deserialize coordinator message"))]
    UnableToDeserializeCoordinatorMessage { source: bincode::Error },

    #[snafu(display("Failed to serialize worker message"))]
    UnableToSerializeWorkerMessage { source: bincode::Error },

    #[snafu(display("Failed to send coordinator message from deserialization task"))]
    UnableToSendCoordinatorMessage { source: mpsc::error::SendError<()> },

    #[snafu(display("Failed to receive worker message"))]
    UnableToReceiveWorkerMessage,

    #[snafu(display("Failed to flush stdout"))]
    UnableToFlushStdout { source: std::io::Error },
}
