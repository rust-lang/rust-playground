use std::fs::{File, OpenOptions};
use std::io::{self, Write};
use std::path::Path;
use std::sync::Mutex;
use std::sync::mpsc::{self, Sender};
use std::time::{Instant, Duration};
use std::{error, thread, net};

use iron;
use iron::prelude::*;
use iron::{Handler, AroundMiddleware};
use iron::status::Status;

#[derive(Debug)]
pub struct LogPacket {
    url: iron::Url,
    ip: net::SocketAddr,
    status: Option<Status>,
    timing: Duration,
}

pub struct StatisticLogger {
    thread: thread::JoinHandle<()>,
    tx: Sender<LogPacket>,
}

pub trait LogWriter {
    type Error: error::Error;

    fn log(&self, log: &LogPacket) -> Result<(), Self::Error>;
}

pub struct FileLogger(File);

impl FileLogger {
    pub fn new<P>(path: P) -> io::Result<FileLogger>
        where P: AsRef<Path>
    {
        OpenOptions::new()
            .write(true)
            .append(true)
            .create(true)
            .open(path)
            .map(FileLogger)
    }
}

impl LogWriter for FileLogger {
    type Error = ::std::io::Error;

    fn log(&self, packet: &LogPacket) -> Result<(), Self::Error> {
        writeln!(&self.0, "{:?}", packet)
    }
}

impl StatisticLogger {
    pub fn new<L>(logger: L) -> StatisticLogger
        where L: LogWriter + Send + 'static
    {
        let (tx, rx) = mpsc::channel();

        let handle = thread::spawn(move || {
            for packet in rx {
                logger.log(&packet).expect("Unable to log request");
            }
        });

        StatisticLogger {
            thread: handle,
            tx: tx,
        }
    }
}

impl AroundMiddleware for StatisticLogger {
    fn around(self, handler: Box<Handler>) -> Box<Handler> {
        Box::new(LogHandler {
            handler: handler,
            thread: self.thread,
            tx: Mutex::new(self.tx),
        })
    }
}

struct LogHandler {
    handler: Box<Handler>,
    #[allow(dead_code)] // We should probably join this, right?
    thread: thread::JoinHandle<()>,
    tx: Mutex<Sender<LogPacket>>,
}

impl Handler for LogHandler {
    fn handle(&self, req: &mut Request) -> IronResult<Response> {
        let (timing, response_result) = time_it(|| self.handler.handle(req));

        let status = response_result.as_ref()
            .map(|success| success.status)
            .unwrap_or_else(|failure| failure.response.status);

        let tx = {
            let guard = self.tx.lock().expect("Unable to get logger channel");
            guard.clone()
        };

        tx.send(LogPacket {
            url: req.url.clone(),
            ip: req.remote_addr,
            status: status,
            timing: timing,
        }).expect("Unable to send log to logger thread");

        response_result
    }
}

fn time_it<F, T>(f: F) -> (Duration, T)
    where F: FnOnce() -> T
{
    let before = Instant::now();
    let result = f();
    let after = Instant::now();

    let timing = after.duration_since(before);

    (timing, result)
}
