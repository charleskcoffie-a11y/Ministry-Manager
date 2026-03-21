#!/usr/bin/env python3
import argparse
import os
import re
import shutil
import sqlite3
import tempfile
import zipfile
from dataclasses import dataclass


VERSE_LABEL_RE = re.compile(r"\\sdparawysiwghidden.*?\\sdfsauto\s+Verse\s+(\d+)\\par", re.IGNORECASE)
SLIDE_MARKER_RE = re.compile(r"\\sdslidemarker", re.IGNORECASE)


@dataclass
class Segment:
    lines: list[str]
    label_line: str | None


def split_segments(lines: list[str]) -> tuple[list[str], list[Segment], list[str]]:
    header: list[str] = []
    body: list[str] = []
    footer: list[str] = []

    started = False
    for line in lines:
        if not started and line.strip().startswith("{\\pard"):
            started = True
        if started:
            body.append(line)
        else:
            header.append(line)

    while body and body[-1].strip() == "}":
        footer.insert(0, body.pop())

    segments: list[Segment] = []
    current: list[str] = []
    for line in body:
        if SLIDE_MARKER_RE.search(line):
            if current:
                segments.append(build_segment(current))
                current = []
            continue
        current.append(line)
    if current:
        segments.append(build_segment(current))

    return header, segments, footer


def build_segment(raw_lines: list[str]) -> Segment:
    label_line = None
    content_lines: list[str] = []
    for line in raw_lines:
        if label_line is None and VERSE_LABEL_RE.search(line):
            label_line = line
        else:
            content_lines.append(line)
    return Segment(lines=content_lines, label_line=label_line)


def make_verse_label(stanza_number: int) -> str:
    return (
        "{\\pard\\sdparawysiwghidden\\qc\\qdef\\sdewparatemplatestyle102"
        "\\plain\\sdewtemplatestyle102\\fs40{\\*\\sdfsreal 20}{\\*\\sdfsdef 20}"
        f"\\sdfsauto Verse {stanza_number}\\par}}"
    )


def regroup_segments(segments: list[Segment], stanza_group_size: int) -> list[Segment]:
    if stanza_group_size <= 1 or len(segments) <= 1:
        return segments

    regrouped: list[Segment] = []
    stanza_index = 1
    for idx in range(0, len(segments), stanza_group_size):
        chunk = segments[idx : idx + stanza_group_size]
        merged_lines: list[str] = []
        for segment in chunk:
            merged_lines.extend(segment.lines)
        regrouped.append(Segment(lines=merged_lines, label_line=make_verse_label(stanza_index)))
        stanza_index += 1
    return regrouped


def regroup_by_verse_labels(segments: list[Segment]) -> list[Segment]:
    regrouped: list[Segment] = []
    current_label: str | None = None
    current_lines: list[str] = []

    def flush_current():
        nonlocal current_label, current_lines
        if current_lines:
            regrouped.append(Segment(lines=current_lines, label_line=current_label))
        current_label = None
        current_lines = []

    for segment in segments:
        if segment.label_line:
            flush_current()
            current_label = segment.label_line
            current_lines = list(segment.lines)
        else:
            if current_label is None:
                regrouped.append(segment)
            else:
                current_lines.extend(segment.lines)

    flush_current()
    return regrouped


def needs_auto_verse_merge(segments: list[Segment]) -> bool:
    in_labeled_block = False
    for segment in segments:
        if segment.label_line:
            in_labeled_block = True
        else:
            if in_labeled_block:
                return True
    return False


def render_rtf(header: list[str], segments: list[Segment], footer: list[str], include_slide_markers: bool) -> str:
    out: list[str] = []
    out.extend(header)
    for i, segment in enumerate(segments):
        if segment.label_line:
            out.append(segment.label_line)
        out.extend(segment.lines)
        if include_slide_markers and i < len(segments) - 1:
            out.append(
                "{\\pard\\sdslidemarker\\qc\\qdef\\sdewparatemplatestyle101\\plain"
                "\\sdewtemplatestyle101\\fs40{\\*\\sdfsreal 20}{\\*\\sdfsdef 20}\\sdfsauto\\par}"
            )
    out.extend(footer)
    return "\n".join(out)


def should_target(title: str, prefixes: list[str]) -> bool:
    up = title.upper()
    return any(up.startswith(prefix) for prefix in prefixes)


def process_song(words_text: str, mode: str, stanza_group_size: int) -> tuple[str, bool]:
    lines = words_text.splitlines()
    header, segments, footer = split_segments(lines)

    if len(segments) <= 1:
        return words_text, False

    if mode == "auto-verse":
        if not needs_auto_verse_merge(segments):
            return words_text, False
        regrouped = regroup_by_verse_labels(segments)
    else:
        regrouped = regroup_segments(segments, stanza_group_size=stanza_group_size)

    converted = render_rtf(header, regrouped, footer, include_slide_markers=True)
    changed = converted != words_text
    return converted, changed


def extract_databases(zip_path: str, expected_root: str, work_dir: str) -> tuple[str, str]:
    songs_db = os.path.join(work_dir, "Songs.db")
    words_db = os.path.join(work_dir, "SongWords.db")
    with zipfile.ZipFile(zip_path, "r") as archive:
        for name, out in (("Songs.db", songs_db), ("SongWords.db", words_db)):
            member = f"{expected_root}/{name}" if expected_root else name
            with archive.open(member) as src, open(out, "wb") as dst:
                shutil.copyfileobj(src, dst)
    return songs_db, words_db


def copy_zip_with_updated_worddb(
    src_zip: str,
    dst_zip: str,
    root_folder: str,
    updated_word_db_path: str,
):
    target_member = f"{root_folder}/SongWords.db"
    with zipfile.ZipFile(src_zip, "r") as src, zipfile.ZipFile(dst_zip, "w", compression=zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            if item.filename == target_member:
                dst.write(updated_word_db_path, arcname=target_member)
            else:
                dst.writestr(item, src.read(item.filename))


def main():
    parser = argparse.ArgumentParser(
        description="Regroup EasyWorship MHB/CAN/CANT song slides into stanza groups and build a new ZIP.",
    )
    parser.add_argument("--zip", required=True, help="Path to source EasyWorship ZIP")
    parser.add_argument(
        "--root-folder",
        default="METHODIST CAN MHB CANT CREED TWI BIBLE PENTECOSTAL 02-04-2022",
        help="Top-level folder name inside ZIP",
    )
    parser.add_argument(
        "--prefixes",
        default="MHB,CAN,CANT",
        help="Comma-separated title prefixes to target (default: MHB,CAN,CANT)",
    )
    parser.add_argument(
        "--mode",
        choices=["group-size", "auto-verse"],
        default="group-size",
        help="Regrouping mode: group-size (fixed merge count) or auto-verse (merge by Verse labels)",
    )
    parser.add_argument(
        "--group-size",
        type=int,
        default=1,
        help="How many existing segments to merge into one stanza (default: 1, no merge)",
    )
    parser.add_argument(
        "--output-zip",
        required=True,
        help="Path to output ZIP with updated SongWords.db",
    )
    parser.add_argument("--dry-run", action="store_true", help="Analyze only; do not write output ZIP")
    args = parser.parse_args()

    prefixes = [part.strip().upper() for part in args.prefixes.split(",") if part.strip()]
    if not prefixes:
        raise SystemExit("No valid prefixes provided.")
    if args.group_size < 1:
        raise SystemExit("--group-size must be >= 1")

    with tempfile.TemporaryDirectory() as work_dir:
        songs_db, words_db = extract_databases(args.zip, args.root_folder, work_dir)
        conn = sqlite3.connect(words_db)
        cur = conn.cursor()
        cur.execute("ATTACH DATABASE ? AS songsdb", (songs_db,))

        rows = cur.execute(
            """
            SELECT w.rowid, w.words, s.title
            FROM main.word w
            JOIN songsdb.song s ON s.rowid = w.song_id
            """
        ).fetchall()

        scanned = 0
        targeted = 0
        changed = 0

        for rowid, words_text, title in rows:
            scanned += 1
            if not title or not should_target(title, prefixes):
                continue

            targeted += 1
            converted, was_changed = process_song(words_text or "", mode=args.mode, stanza_group_size=args.group_size)
            if was_changed:
                changed += 1
                if not args.dry_run:
                    cur.execute("UPDATE main.word SET words=? WHERE rowid=?", (converted, rowid))

        if not args.dry_run:
            conn.commit()
        conn.close()

        print(f"Scanned songs: {scanned}")
        print(f"Targeted songs ({','.join(prefixes)}): {targeted}")
        print(f"Changed songs: {changed}")

        if args.dry_run:
            print("Dry run complete. No files written.")
            return

        os.makedirs(os.path.dirname(args.output_zip) or ".", exist_ok=True)
        copy_zip_with_updated_worddb(
            src_zip=args.zip,
            dst_zip=args.output_zip,
            root_folder=args.root_folder,
            updated_word_db_path=words_db,
        )
        print(f"Wrote updated ZIP: {args.output_zip}")


if __name__ == "__main__":
    main()
