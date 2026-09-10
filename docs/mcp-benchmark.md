# MCP stdio overhead benchmark

[`scripts/benchmark-mcp.ts`](../scripts/benchmark-mcp.ts) starts an MCP server
as a child process, performs the read-only connection handshake and
`tools/list`, then reports timing, wire bytes, tool names, and child memory
usage. It never calls `tools/call` or any other MCP tool.

Run it with an executable and its arguments after `--`:

```sh
bun run scripts/benchmark-mcp.ts -- bun --no-env-file index.ts --stdio
```

To measure the published bundle, build first (`bun run build`) and pass
`dist/index.js` instead of `index.ts`.

The default client is the modern split SDK v2 client. For comparison with a
legacy client, explicitly enable server compatibility:

```sh
MCP_LEGACY_COMPATIBILITY=true bun run scripts/benchmark-mcp.ts --client both --runs 5 -- \
  bun --no-env-file index.ts --stdio
```

Use `--client modern` to run only the v2 client. It uses the canonical
`@modelcontextprotocol/client` API with
`versionNegotiation: { mode: "auto" }`; see the [MCP client protocol support
guide](mcp-client-protocol-support.md) for protocol details. Supply another
package root explicitly when needed:

```sh
bun run scripts/benchmark-mcp.ts \
  --client modern \
  --client-root /path/to/node_modules \
  -- bun --no-env-file index.ts --stdio
```

The benchmark itself does not read `.env` files. It passes an explicit child
environment containing a temporary `HOME`, XDG directories, and temporary
directory, along with `TRANSPORT=stdio`,
`DISABLE_WALLET_TOOLS=true`, and `DISABLE_BROADCASTING=true`. Wallet key,
password, token, vault, and other sensitive variable names are never copied
from the parent environment; sensitive or reserved names are rejected by
`--env NAME=VALUE`. Direct Bun targets receive `--no-env-file` automatically
when that flag is absent. Keep the target command read-only as well.

Only the following MCP exchange is measured:

```text
legacy: initialize → notifications/initialized → tools/list
modern: server/discover → tools/list
       (or the legacy sequence after an automatic fallback)
```

The JSON report is the default output. `--human` prints a compact tabular
view. `--runs N` repeats each selected client and adds median values to the
report. The `protocolEra` field records the era actually negotiated, which is
useful when a modern client falls back to a legacy server.

The reported fields have these meanings:

| Field | Meaning |
| --- | --- |
| `startupMs` | Time from starting the benchmark sample through client connect, including the initialize or discovery handshake. |
| `listMs` | Time spent awaiting `tools/list` after connect. |
| `totalMs` | `startupMs + listMs`. |
| `toolCount` | Number of returned tool definitions with a valid name. |
| `toolNames` | Returned tool names, in server order. |
| `toolJsonBytes` | UTF-8 byte length of `JSON.stringify(result.tools)`, excluding the JSON-RPC envelope and line delimiter. |
| `toolNamesJsonBytes` | UTF-8 byte length of `JSON.stringify(result.tools.map(tool => tool.name))`. |
| `listResponseBytes` | Exact UTF-8 bytes in the matched stdio `tools/list` JSON-RPC frame, including its LF delimiter. |
| `stdinBytes` / `stdoutBytes` | UTF-8 bytes written to or received from the instrumented session child through completion of `tools/list`. |
| `rssBytes` / `peakRssBytes` | Instrumented session child RSS samples in bytes through completion of `tools/list`, where `ps` is available; the peak is sampled about every 25 ms and can be `null`. |

These are byte counts, not token estimates. Tokenization depends on the model
and tokenizer, so the benchmark intentionally does not convert bytes to
tokens. Byte counts also describe different boundaries: `toolJsonBytes` is the
tool array, while `listResponseBytes` includes the JSON-RPC response envelope.
The wire counters and RSS values are frozen as soon as the `tools/list`
response completes, before client and child shutdown begins, so shutdown output
and shutdown-only memory are excluded.
When the modern client negotiates with its stdio transport, its SDK may use a
disposable sibling process for `server/discover`; that probe is included in
`startupMs` but its hidden transport bytes and RSS are not included in the
session-child counters.

Useful options are:

```text
--client legacy|modern|both   Client implementation (default: modern)
--runs N                      Repetitions per selected client (default: 1)
--timeout-ms N                Per-request timeout (default: 10000)
--cwd PATH                    Child working directory
--env NAME=VALUE              Additional non-sensitive child variable
--client-root PATH            Additional node_modules search root
--human                       Print a table instead of JSON
```

All target arguments, including target flags beginning with `--`, must come
after the benchmark's separator. A nonzero exit status means that no sample
completed or a selected client failed.
