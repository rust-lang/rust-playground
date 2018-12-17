FROM shepmaster/rust-nightly as sources

RUN rustup component add rust-src

FROM sources as build

RUN cargo install --git https://github.com/solson/miri/ miri
RUN cargo miri setup

FROM sources

COPY --from=build /root/.cache/miri /root/.cache/miri
COPY --from=build /root/.cargo/bin/miri /root/.cargo/bin
COPY --from=build /root/.cargo/bin/cargo-miri /root/.cargo/bin
ADD cargo-miri-playground /root/.cargo/bin
