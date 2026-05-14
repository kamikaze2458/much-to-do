# ═══════════════════════════════════════════════════
# Stage 1 – Build
# ═══════════════════════════════════════════════════
FROM golang:1.22-alpine AS builder

# ca-certificates needed for HTTPS calls to MongoDB Atlas
RUN apk add --no-cache ca-certificates git

WORKDIR /src

# Cache module downloads separately from source changes
COPY go.mod go.sum* ./
RUN go mod download

# Copy all source
COPY . .

# Statically linked, stripped binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
    -ldflags="-s -w -extldflags=-static" \
    -trimpath \
    -o /bin/server \
    .

# ═══════════════════════════════════════════════════
# Stage 2 – Runtime  (Google distroless: no shell, no OS tools)
# ═══════════════════════════════════════════════════
FROM gcr.io/distroless/static-debian12:nonroot

# Copy the CA bundle so TLS to Atlas works
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy the binary
COPY --from=builder /bin/server /server

EXPOSE 8080

ENTRYPOINT ["/server"]
