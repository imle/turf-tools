"""Staging helper for voter-file uploads from the admin UI."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.import_uploads import ImportUploadError, stage_import_upload


def test_stage_import_upload_writes_file(tmp_path: Path) -> None:
    result = stage_import_upload(
        tmp_path,
        "voters.csv",
        iter([b"County,Voter Registration Number\n", b"FULTON,1\n"]),
    )
    path = Path(result["path"])
    assert path.exists()
    assert path.name == "voters.csv"
    assert path.read_text().startswith("County,")
    assert result["filename"] == "voters.csv"
    assert result["bytes"] == path.stat().st_size
    assert path.is_relative_to(tmp_path)


def test_stage_import_upload_rejects_empty_and_oversize(tmp_path: Path) -> None:
    with pytest.raises(ImportUploadError, match="Empty"):
        stage_import_upload(tmp_path, "voters.csv", iter([]))

    with pytest.raises(ImportUploadError, match="too large"):
        stage_import_upload(tmp_path, "voters.csv", iter([b"abcdef"]), max_bytes=4)


def test_stage_import_upload_strips_path_components(tmp_path: Path) -> None:
    result = stage_import_upload(tmp_path, "../evil.csv", iter([b"x"]))
    assert Path(result["path"]).name == "evil.csv"
    assert Path(result["path"]).is_relative_to(tmp_path)
