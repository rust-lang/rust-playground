FROM docker:dind

EXPOSE 8080

COPY ./assets/playground.service /etc/systemd/system/playground.service

COPY ../target/release/ui .
COPY ../ui/frontend/build .
COPY ../compiler/fetch.sh .

RUN ./fetch.sh

RUN systemctl start playground