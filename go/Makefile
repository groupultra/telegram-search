# Makefile for the telegram-search Go rewrite.
#
# Targets:
#   make build       — build both binaries
#   make generate    — run ent code generation
#   make test        — run tests
#   make lint        — run golangci-lint
#   make tui         — run the TUI command
#   make server      — run the server command

.PHONY: build generate test lint tui server clean

GOFLAGS := -trimpath
BINDIR  := ./bin

build: $(BINDIR)/server $(BINDIR)/tui

$(BINDIR)/server:
	@mkdir -p $(BINDIR)
	go build $(GOFLAGS) -o $(BINDIR)/server ./cmd/server

$(BINDIR)/tui:
	@mkdir -p $(BINDIR)
	go build $(GOFLAGS) -o $(BINDIR)/tui ./cmd/tui

# NOTE: Run 'make generate' once after cloning to produce the ent client code.
# The generated files are NOT committed to the repository; they are produced
# from the schema definitions in ent/schema/.
generate:
	go generate ./ent/...

test:
	go test -race -count=1 ./...

lint:
	golangci-lint run ./...

lint-fix:
	golangci-lint run --fix ./...

tui: $(BINDIR)/tui
	$(BINDIR)/tui

server: $(BINDIR)/server
	$(BINDIR)/server

clean:
	rm -rf $(BINDIR)
