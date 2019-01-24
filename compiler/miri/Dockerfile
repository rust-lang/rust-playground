FROM shepmaster/rust-nightly:sources

RUN rustup component add rust-src

RUN cargo install --git https://github.com/solson/miri/ miri
RUN cargo miri setup
RUN cargo miri run
RUN rm src/*.rs

ADD cargo-miri-playground /root/.cargo/bin

ENTRYPOINT ["/root/entrypoint.sh"]
