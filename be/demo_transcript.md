# Live Demo Transcript

Date: 2026-02-13

Scope:
- Run API server with real `.env`
- Call live endpoints in sequence: health -> start -> chat -> cleanup -> artifacts
- Capture responses and runtime errors

## Runtime Preconditions

- `GEMINI_API_KEY` configured in `be/.env`
- `google-genai` installed
- Actian client wheel installed in `.venv`
- Docker container `vectoraidb` running and host port `50051` open

## API Transcript

```text
## Health
HTTP/1.1 200 OK
{"status":"ok","vector_db":"unreachable","vector_client_installed":true,"embedding_configured":true,"embedding_model":"text-embedding-004","gemini_configured":true,"gemini_model":"gemini-3-flash",...}

## Session Start
HTTP/1.1 500 Internal Server Error
Internal Server Error

## Chat
HTTP/1.1 500 Internal Server Error
Internal Server Error

## Cleanup Generate
HTTP/1.1 500 Internal Server Error
Internal Server Error

## Artifacts
HTTP/1.1 500 Internal Server Error
Internal Server Error
```

## Root Cause Observed in Server Logs

All stateful endpoints failed on VectorDB calls with:

- `grpc.aio._call.AioRpcError`
- `StatusCode.UNAVAILABLE`
- `failed to connect to all addresses`
- `ipv4:127.0.0.1:50051: FD shutdown`

This confirms API wiring is functional, but live persistence is blocked by server-side gRPC connection resets from the current VectorDB runtime.

## Conclusion

- End-to-end flow is implemented and callable.
- Live run is currently blocked by VectorDB runtime stability.
- Next successful live run requires a working VectorDB image/runtime that responds correctly to gRPC requests.
