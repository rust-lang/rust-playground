FROM ubuntu:14.04

RUN apt-get update && apt-get install -y \
    curl \
    gcc \
 && rm -rf /var/lib/apt/lists/*

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y

ENV PATH=/root/.cargo/bin:$PATH

ADD entrypoint.sh /root/

ENTRYPOINT ["/root/entrypoint.sh"]
