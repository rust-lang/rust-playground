FROM cruizba/ubuntu-dind

EXPOSE 5000

ARG docker_repo
RUN test -n "$docker_repo"

RUN echo Using Docker Repo: ${docker_repo}
ENV DOCKER_REPO=${docker_repo}

ENV PLAYGROUND_UI_ROOT=/build
ENV PLAYGROUND_GITHUB_TOKEN=""
ENV PLAYGROUND_UI_ADDRESS=0.0.0.0

COPY ./compiler/fetch.sh .
COPY ./target/release/ui .
COPY ./ui/frontend/build/ ./build/
COPY ./deployment/startup.sh .

RUN chmod 755 startup.sh

ENTRYPOINT ./startup.sh
