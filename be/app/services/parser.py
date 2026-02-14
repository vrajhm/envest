from pathlib import Path


class ParserService:
    async def parse_document(self, file_path: str) -> str:
        # MVP parser: plain text decode. Replace with LlamaParse integration next.
        data = Path(file_path).read_bytes()
        text = data.decode("utf-8", errors="ignore").strip()
        if not text:
            raise ValueError("Parsed document text is empty.")
        return text
