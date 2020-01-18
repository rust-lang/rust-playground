FROM shepmaster/rust-nightly:sources

RUN rustup component add rust-src miri

RUN cargo miri setup
RUN cargo miri run
RUN rm src/*.rs

ADD --chown=playground cargo-miri-playground /playground/.cargo/bin

ENTRYPOINT ["/playground/tools/entrypoint.sh"]
