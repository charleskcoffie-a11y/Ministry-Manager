#!/usr/bin/env python3
import argparse
import json
import os
import re
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from urllib import request, error


DEFAULT_ZIP = Path(
    "C:/Users/charlesc/OneDrive - Ghana Methodist church of Toronto/GMCT/EASYWORSHIP/METHODIST_MHB_CAN_CANT_auto_stanza.zip"
)
DEFAULT_ROOT = "METHODIST CAN MHB CANT CREED TWI BIBLE PENTECOSTAL 02-04-2022"
DEFAULT_OUT = Path("reports/methodist_songs_flat_converted.json")
TARGET_PREFIXES = {"MHB", "CAN", "CANT"}
UPSERT_BATCH_SIZE = 200


def decode_rtf_text(value: str) -> str:
    result = value or ""

    def repl_unicode(match: re.Match[str]) -> str:
        raw = int(match.group(1))
        normalized = raw if raw >= 0 else 65536 + raw
        return chr(normalized)

    result = re.sub(r"\\u(-?\d+)\?", repl_unicode, result)
    result = re.sub(r"\\'([0-9a-fA-F]{2})", lambda m: chr(int(m.group(1), 16)), result)
    result = re.sub(r"\\(~|-|_|:|\\|\{|\})", r"\1", result)
    result = re.sub(r"\\[a-zA-Z]+-?\d* ?", "", result)
    result = result.replace("{", "").replace("}", "")
    result = re.sub(r"\s+", " ", result).strip()
    return result


def parse_lyrics_from_rtf(rtf: str) -> str:
    lines = (rtf or "").splitlines()
    sections: list[dict[str, list[str] | str | None]] = []
    current: dict[str, list[str] | str | None] | None = None

    def ensure_section() -> dict[str, list[str] | str | None]:
        nonlocal current
        if current is None:
            current = {"label": None, "lines": []}
            sections.append(current)
        return current

    for raw_line in lines:
        if not raw_line or "\\sdslidemarker" in raw_line:
            continue

        verse_match = re.search(r"Verse\s+(\d+)", raw_line, flags=re.IGNORECASE)
        if "\\sdparawysiwghidden" in raw_line and verse_match:
            current = {"label": f"Verse {verse_match.group(1)}", "lines": []}
            sections.append(current)
            continue

        content_match = re.search(r"\\sdfsauto\s*(.*?)\\par", raw_line, flags=re.IGNORECASE)
        if not content_match:
            continue

        decoded = decode_rtf_text(content_match.group(1))
        if not decoded:
            continue

        section = ensure_section()
        section_lines = section["lines"]
        if isinstance(section_lines, list):
            section_lines.append(decoded)

    normalized_sections = []
    for section in sections:
        section_lines = section.get("lines")
        if not isinstance(section_lines, list):
            continue

        cleaned_lines = [line.strip() for line in section_lines if line.strip()]
        if not cleaned_lines:
            continue

        normalized_sections.append({"label": section.get("label"), "lines": cleaned_lines})

    blocks = []
    for section in normalized_sections:
        label = str(section.get("label") or "").strip()
        content = "\n".join(section["lines"])
        blocks.append(f"{label}\n{content}".strip() if label else content)

    return "\n\n".join(blocks).strip()


def extract_code_parts(title: str):
    match = re.match(r"^(MHB|CAN|CANT)\s*([0-9]+)\s*(.*)$", (title or "").strip(), flags=re.IGNORECASE)
    if not match:
        return None

    prefix = match.group(1).upper()
    number_text = match.group(2)
    number = int(number_text) if number_text.isdigit() else None
    clean_title = (match.group(3) or "").strip()

    return {
        "prefix": prefix,
        "number": number,
        "code": f"{prefix}{number_text}",
        "clean_title": clean_title,
    }


def map_collection(prefix: str) -> str:
    if prefix == "MHB":
        return "MHB"
    if prefix == "CAN":
        return "CAN"
    if prefix == "CANT":
        return "CANTICLES"
    return prefix


def get_env(*keys: str) -> str:
    for key in keys:
        value = os.getenv(key, "").strip().strip('"').strip("'")
        if value:
            return value
    return ""


def load_dotenv(repo_root: Path):
    env_path = repo_root / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        if not key or os.getenv(key):
            continue

        os.environ[key] = value.strip().strip('"').strip("'")


def load_songs(zip_path: Path, root_folder: str):
    if not zip_path.exists():
        raise FileNotFoundError(f"ZIP not found: {zip_path}")

    with tempfile.TemporaryDirectory(prefix="mm-converted-hymns-") as temp_dir:
        temp = Path(temp_dir)
        songs_db = temp / "Songs.db"
        words_db = temp / "SongWords.db"

        with zipfile.ZipFile(zip_path, "r") as archive:
            with archive.open(f"{root_folder}/Songs.db") as src, songs_db.open("wb") as dst:
                dst.write(src.read())
            with archive.open(f"{root_folder}/SongWords.db") as src, words_db.open("wb") as dst:
                dst.write(src.read())

        conn = sqlite3.connect(str(words_db))
        try:
            conn.execute("ATTACH DATABASE ? AS songsdb", (str(songs_db),))
            rows = conn.execute(
                """
                SELECT
                    w.song_id AS id,
                    s.title AS source_title,
                    s.author,
                    s.copyright,
                    s.tags,
                    s.reference_number,
                    w.words
                FROM main.word w
                JOIN songsdb.song s ON s.rowid = w.song_id
                ORDER BY w.song_id ASC
                """
            ).fetchall()
        finally:
            conn.close()

    songs = []
    for row in rows:
        parts = extract_code_parts(row[1])
        if not parts or parts["prefix"] not in TARGET_PREFIXES:
            continue

        lyrics = parse_lyrics_from_rtf(row[6] or "")
        if not lyrics:
            continue

        songs.append(
            {
                "id": int(row[0]),
                "collection": map_collection(parts["prefix"]),
                "code": parts["code"],
                "number": parts["number"],
                "title": parts["clean_title"] or row[1],
                "raw_title": row[1],
                "lyrics": lyrics,
                "author": row[2],
                "copyright": row[3],
                "tags": row[4],
                "reference_number": row[5],
            }
        )

    order = {"MHB": 1, "CANTICLES": 2, "CAN": 3}
    songs.sort(
        key=lambda item: (
            order.get(item["collection"], 99),
            item["number"] if isinstance(item["number"], int) else 10**9,
            item["title"],
        )
    )
    return songs


def write_output(output_path: Path, songs):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(songs, ensure_ascii=False, indent=2), encoding="utf-8")


def print_summary(zip_path: Path, output_path: Path, songs):
    by_collection = {}
    for song in songs:
        key = song["collection"]
        by_collection[key] = by_collection.get(key, 0) + 1

    print(f"ZIP: {zip_path}")
    print(f"Output JSON: {output_path}")
    print(f"Songs extracted: {len(songs)}")
    for key in sorted(by_collection.keys()):
        print(f"  - {key}: {by_collection[key]}")


def upsert_songs(repo_root: Path, songs, allow_default_project: bool):
    load_dotenv(repo_root)

    supabase_url = get_env("SUPABASE_URL", "VITE_SUPABASE_URL", "REACT_APP_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = get_env(
        "SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_ANON_KEY",
        "VITE_SUPABASE_ANON_KEY",
        "REACT_APP_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    )

    if not supabase_url or not supabase_key:
        raise RuntimeError("Missing Supabase credentials in environment/.env.")

    default_url = "https://YOUR_PROJECT.supabase.co"
    if not allow_default_project and supabase_url == default_url:
        raise RuntimeError("Refusing to apply against default placeholder URL. Configure .env or pass --allow-default-project.")

    for start in range(0, len(songs), UPSERT_BATCH_SIZE):
        batch = songs[start : start + UPSERT_BATCH_SIZE]
        body = json.dumps(batch, ensure_ascii=False).encode("utf-8")
        req = request.Request(
            f"{supabase_url}/rest/v1/songs?on_conflict=id",
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            },
        )

        try:
            with request.urlopen(req) as response:
                if response.status < 200 or response.status >= 300:
                    raise RuntimeError(f"Supabase returned status {response.status}")
        except error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Upsert failed at batch {start}: {exc.code} {details}") from exc

        print(f"Upserted {min(start + UPSERT_BATCH_SIZE, len(songs))}/{len(songs)}")


def main():
    parser = argparse.ArgumentParser(description="Export converted MHB/CAN/CANT songs from EasyWorship ZIP and optionally upsert to Supabase.")
    parser.add_argument("--zip", default=str(DEFAULT_ZIP), help="Path to converted EasyWorship ZIP")
    parser.add_argument("--root", default=DEFAULT_ROOT, help="Root folder name inside ZIP")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Output JSON path")
    parser.add_argument("--apply", action="store_true", help="Apply upsert to Supabase songs table")
    parser.add_argument("--allow-default-project", action="store_true", help="Allow apply with default placeholder project URL")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    zip_path = Path(args.zip)
    out_path = Path(args.out)

    songs = load_songs(zip_path, args.root)
    write_output(out_path, songs)
    print_summary(zip_path, out_path, songs)

    if not args.apply:
        print("Dry run only. Re-run with --apply to upsert into Supabase songs table.")
        return

    upsert_songs(repo_root, songs, allow_default_project=args.allow_default_project)
    print("Supabase upsert completed.")


if __name__ == "__main__":
    main()
