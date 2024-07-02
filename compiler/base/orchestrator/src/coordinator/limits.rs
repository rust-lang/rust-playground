use futures::{future::BoxFuture, prelude::*};
use std::{
    fmt,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};

use super::{ContainerPermit, ProcessPermit, ResourceLimits, ResourceResult};

/// Describe how the resource was (or was not) acquired.
#[derive(Debug, Copy, Clone, PartialEq)]
pub enum Acquisition {
    /// The success path
    Acquired,
    /// The caller did not wait to acquire anything
    Aborted,
    /// Could not acquire
    Error,
}

impl Acquisition {
    fn from_result<T, E>(value: &Result<T, E>) -> Self {
        match value {
            Ok(_) => Acquisition::Acquired,
            Err(_) => Acquisition::Error,
        }
    }
}

/// Hooks for monitoring how resources are requested and used.
pub trait Lifecycle: Send + Sync + fmt::Debug + Clone + 'static {
    fn container_start(&self) {}
    fn container_acquired(&self, #[allow(unused)] how: Acquisition) {}
    fn container_release(&self) {}

    fn process_start(&self) {}
    fn process_acquired(&self, #[allow(unused)] how: Acquisition) {}
    fn process_release(&self) {}
}

/// Does nothing for each event.
#[derive(Debug, Clone)]
pub struct NoOpLifecycle;

impl Lifecycle for NoOpLifecycle {}

/// Prints to stderr for each event.
#[derive(Debug, Clone)]
pub struct StderrLifecycle;

impl Lifecycle for StderrLifecycle {
    fn container_start(&self) {
        eprintln!("container_start");
    }

    fn container_acquired(&self, how: Acquisition) {
        eprintln!("container_acquired {how:?}");
    }

    fn container_release(&self) {
        eprintln!("container_release");
    }

    fn process_start(&self) {
        eprintln!("process_start");
    }

    fn process_acquired(&self, how: Acquisition) {
        eprintln!("process_acquired {how:?}");
    }

    fn process_release(&self) {
        eprintln!("process_release");
    }
}

/// A reasonable choice when there's a single [`ResourceLimits`][] in
/// the entire process.
///
/// This represents uniqueness via a combination of
///
/// 1. **process start time** — this helps avoid conflicts from other
///    processes, assuming they were started at least one second
///    apart.
///
/// 2. **instance counter** — this avoids conflicts from other
///    [`Coordinator`][super::Coordinator]s started inside this
///    process.
#[derive(Debug)]
pub struct Global<L = NoOpLifecycle> {
    lifecycle: L,
    container_semaphore: Arc<Semaphore>,
    process_semaphore: Arc<Semaphore>,
    start: u64,
    id: AtomicU64,
}

/// Manages containers
#[derive(Debug)]
struct TrackContainer<L>
where
    L: Lifecycle,
{
    lifecycle: L,
    #[allow(unused)]
    container_permit: OwnedSemaphorePermit,
    process_semaphore: Arc<Semaphore>,
    start: u64,
    id: u64,
}

/// Manages processess
#[derive(Debug)]
struct TrackProcess<L>
where
    L: Lifecycle,
{
    lifecycle: L,
    #[allow(unused)]
    process_permit: OwnedSemaphorePermit,
}

impl Global<NoOpLifecycle> {
    pub fn new(container_limit: usize, process_limit: usize) -> Self {
        Self::with_lifecycle(container_limit, process_limit, NoOpLifecycle)
    }
}

impl<L> Global<L>
where
    L: Lifecycle,
{
    pub fn with_lifecycle(container_limit: usize, process_limit: usize, lifecycle: L) -> Self {
        let container_semaphore = Arc::new(Semaphore::new(container_limit));
        let process_semaphore = Arc::new(Semaphore::new(process_limit));

        let now = std::time::SystemTime::now();
        let start = now
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let id = AtomicU64::new(0);

        Self {
            lifecycle,
            container_semaphore,
            process_semaphore,
            start,
            id,
        }
    }
}

impl<L> ResourceLimits for Global<L>
where
    L: Lifecycle,
{
    fn next_container(&self) -> BoxFuture<'static, ResourceResult<Box<dyn ContainerPermit>>> {
        let lifecycle = self.lifecycle.clone();
        let container_semaphore = self.container_semaphore.clone();
        let process_semaphore = self.process_semaphore.clone();
        let start = self.start;
        let id = self.id.fetch_add(1, Ordering::SeqCst);

        async move {
            let guard = ContainerAcquireGuard::start(&lifecycle);

            let container_permit = container_semaphore.acquire_owned().await;
            let container_permit = guard.complete(container_permit)?;

            let token = TrackContainer {
                lifecycle,
                container_permit,
                process_semaphore,
                start,
                id,
            };
            Ok(Box::new(token) as _)
        }
        .boxed()
    }
}

impl<L> fmt::Display for TrackContainer<L>
where
    L: Lifecycle,
{
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self { start, id, .. } = self;
        write!(f, "{start}-{id}")
    }
}

impl<L> ContainerPermit for TrackContainer<L>
where
    L: Lifecycle,
{
    fn next_process(&self) -> BoxFuture<'static, ResourceResult<Box<dyn ProcessPermit>>> {
        let lifecycle = self.lifecycle.clone();
        let process_semaphore = self.process_semaphore.clone();

        async move {
            let guard = ProcessAcquireGuard::start(&lifecycle);

            let process_permit = process_semaphore.acquire_owned().await;
            let process_permit = guard.complete(process_permit)?;

            let token = TrackProcess {
                lifecycle,
                process_permit,
            };
            Ok(Box::new(token) as _)
        }
        .boxed()
    }
}

impl<L> Drop for TrackContainer<L>
where
    L: Lifecycle,
{
    fn drop(&mut self) {
        self.lifecycle.container_release()
    }
}

impl<L> ProcessPermit for TrackProcess<L> where L: Lifecycle {}

impl<L> Drop for TrackProcess<L>
where
    L: Lifecycle,
{
    fn drop(&mut self) {
        self.lifecycle.process_release()
    }
}

/// Lifecycle drop guard for containers
struct ContainerAcquireGuard<'a, L: Lifecycle>(&'a L, Acquisition);

impl<'a, L> ContainerAcquireGuard<'a, L>
where
    L: Lifecycle,
{
    fn start(lifecycle: &'a L) -> Self {
        lifecycle.container_start();
        Self(lifecycle, Acquisition::Aborted)
    }

    fn complete<T, E>(mut self, r: Result<T, E>) -> Result<T, E> {
        self.1 = Acquisition::from_result(&r);
        r
    }
}

impl<'a, L> Drop for ContainerAcquireGuard<'a, L>
where
    L: Lifecycle,
{
    fn drop(&mut self) {
        self.0.container_acquired(self.1);
    }
}

/// Lifecycle drop guard for processes
struct ProcessAcquireGuard<'a, L>(&'a L, Acquisition)
where
    L: Lifecycle;

impl<'a, L> ProcessAcquireGuard<'a, L>
where
    L: Lifecycle,
{
    fn start(lifecycle: &'a L) -> Self {
        lifecycle.process_start();
        Self(lifecycle, Acquisition::Aborted)
    }

    fn complete<T, E>(mut self, r: Result<T, E>) -> Result<T, E> {
        self.1 = Acquisition::from_result(&r);
        r
    }
}

impl<'a, L> Drop for ProcessAcquireGuard<'a, L>
where
    L: Lifecycle,
{
    fn drop(&mut self) {
        self.0.process_acquired(self.1);
    }
}
