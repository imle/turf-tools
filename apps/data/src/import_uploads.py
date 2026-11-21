"""Stage voter-file uploads from the admin UI onto the data server's disk.

The web edge authenticates and streams the body here; the returned path is
stored on the dataset version as a normal local import source.
"""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Iterator

# Statewide extracts can be large; keep a hard ceiling on disk use.
MAX_IMPORT_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024


class ImportUploadError(ValueError):
    """User-facing staging failure (empty body, bad name, oversize)."""


def stage_import_upload(
    root: Path,
    filename: str,
    chunks: Iterator[bytes],
    *,
    max_bytes: int = MAX_IMPORT_UPLOAD_BYTES,
) -> dict[str, object]:
    """Write `chunks` under `root/<uuid>/<filename>` and return path metadata."""
    safe_name = Path(filename).name
    if not safe_name or safe_name in {".", ".."}:
        raise ImportUploadError("Invalid filename.")

    root = root.expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    dest_dir = root / uuid.uuid4().hex
    dest_dir.mkdir()
    dest = dest_dir / safe_name

    written = 0
    try:
        with dest.open("wb") as out:
            for chunk in chunks:
                written += len(chunk)
                if written > max_bytes:
                    raise ImportUploadError("File is too large to upload.")
                out.write(chunk)
    except Exception:
        shutil.rmtree(dest_dir, ignore_errors=True)
        raise

    if written == 0:
        shutil.rmtree(dest_dir, ignore_errors=True)
        raise ImportUploadError("Empty upload.")

    return {"path": str(dest), "filename": safe_name, "bytes": written}
