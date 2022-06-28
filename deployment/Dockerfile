FROM cruizba/ubuntu-dind

EXPOSE 8080/tcp

ARG docker_repo

COPY ./deployment/assets/playground.service /etc/systemd/system/playground.service
COPY ./target/release/ui .
COPY ./ui/frontend/build .

