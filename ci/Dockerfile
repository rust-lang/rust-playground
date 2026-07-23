FROM rust:alpine AS build

RUN apk add musl-dev openssl-dev openssl-libs-static

# Adding -C relocation-model=static due to
# https://github.com/rust-lang/rust/issues/95926

# Adding this to find the statically-built version
ENV OPENSSL_NO_PKG_CONFIG=1 OPENSSL_STATIC=1 OPENSSL_DIR=/usr/

ENV CARGO_TARGET_DIR=/target

RUN mkdir /output

COPY compiler/base/asm-cleanup /compiler/base/asm-cleanup
COPY compiler/base/orchestrator /compiler/base/orchestrator
COPY compiler/base/modify-cargo-toml /compiler/base/modify-cargo-toml
COPY ui /ui

WORKDIR /compiler/base/orchestrator

RUN \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    --mount=type=cache,target=/target/ \
    cargo rustc --profile test --lib --locked -- --cfg force_docker -C relocation-model=static; \
    test_bin=$(find /target/debug/deps/ -name "orchestrator*" -type f -perm -a=x); \
    mv "${test_bin}" /output/unit_tests_orchestrator;

WORKDIR /ui

RUN \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    --mount=type=cache,target=/target/ \
    cargo rustc --tests --locked -- -C relocation-model=static; \
    test_bin=$(find /target/debug/deps/ -name "ui*" -type f -perm -a=x); \
    mv "${test_bin}" /output/unit_tests_ui;

RUN \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    --mount=type=cache,target=/target/ \
    cargo rustc --locked --release -- -C relocation-model=static; \
    mv /target/release/ui /output/ui;

# ====================

FROM scratch AS output

COPY --from=build /output /

# ====================

FROM rust:alpine AS cache-import

COPY --from=cache /cache.tar /

RUN \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    --mount=type=cache,target=/target/ \
    tar xf /cache.tar -C /

# ====================

FROM rust:alpine AS cache-export-prepare

RUN \
    --mount=type=cache,target=/usr/local/cargo/registry/ \
    --mount=type=cache,target=/target/ \
    tar cf /cache.tar /usr/local/cargo/registry/ /target/

# ====================

FROM scratch AS cache-export

COPY --from=cache-export-prepare /cache.tar /
