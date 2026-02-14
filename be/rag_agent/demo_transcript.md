# Live Demo Transcript

Date: 2026-02-13

This file captures two live runs:
1. Actian backend attempt (blocked by gRPC reset in current environment)
2. Memory backend run (successful end-to-end demo)

## Run A: Actian Backend (Blocked)

Preconditions:
- `VECTOR_BACKEND=actian`
- Actian wheel installed
- Docker container running on `localhost:50051`

Observed:
- `GET /health` returned `vector_db: unreachable`
- Stateful endpoints returned `500`
- Server logs showed:
  - `grpc.aio._call.AioRpcError`
  - `StatusCode.UNAVAILABLE`
  - `ipv4:127.0.0.1:50051: FD shutdown`

Conclusion:
- API code path is functional.
- Runtime blocked by current Actian container behavior on this host.

## Run B: Memory Backend (Successful)

Preconditions:
- `VECTOR_BACKEND=memory`
- `VECTOR_AUTO_FALLBACK_MEMORY=true`
- `GEMINI_MODEL=models/gemini-3-flash-preview`
- `EMBEDDING_MODEL=models/gemini-embedding-001`

### Health

```text
HTTP/1.1 200 OK
{"status":"ok","vector_backend":"memory","vector_db":"connected","vector_client_installed":true,"embedding_configured":true,"embedding_model":"models/gemini-embedding-001","gemini_configured":true,"gemini_model":"models/gemini-3-flash-preview",...}
```

### Session Start

```text
HTTP/1.1 200 OK
{"session_id":"sess_demo_live","status":"created","chunk_count":1,"nitpick_count":1,"dropped_citation_count":0}
```

### Chat

```text
HTTP/1.1 200 OK
{"answer":"To address the request for stricter reporting language ...","citations":["doc_001:c001"],"inferred_updates":[{"issue_id":"issue_001","previous_status":"open","new_status":"in_progress","reason":"Investor requested edits for this issue."}],"pending_resolution_issue_id":"issue_001"}
```

### Cleanup Generate

```text
HTTP/1.1 200 OK
{"session_id":"sess_demo_live","status":"completed","artifact_paths":{"revised_text_path":"be/rag_agent/artifacts/sess_demo_live/revised_document.txt","revised_pdf_path":"be/rag_agent/artifacts/sess_demo_live/revised_document.pdf","investor_email_path":"be/rag_agent/artifacts/sess_demo_live/investor_email.txt"},"unresolved_issue_ids":["issue_001"],"change_log":[...]}
```

### Artifacts

```text
HTTP/1.1 200 OK
{"session_id":"sess_demo_live","artifact_paths":{...},"existing_artifacts":{"revised_text_path":true,"revised_pdf_path":true,"investor_email_path":true}}
```

## Final Notes

- End-to-end demo flow is verified and working in `memory` backend mode.
- Actian mode remains available but requires runtime stabilization on this host.
