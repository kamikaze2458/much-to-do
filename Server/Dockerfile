FROM golang:1.25-alpine AS builder

RUN apk add --no-cache ca-certificates git

WORKDIR /src

COPY MuchToDo/go.mod MuchToDo/go.sum ./
RUN go mod download

COPY MuchToDo/ .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
    -ldflags="-s -w -extldflags=-static" \
    -trimpath \
    -o /bin/server \
    ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /bin/server /server

EXPOSE 8080

ENTRYPOINT ["/server"]
