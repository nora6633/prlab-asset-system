#!/usr/bin/env python3
"""Bulk-import assets from a CSV file into the `assets` table.

Expected CSV columns (header row required):
    asset_no, name, alias, model, location, status, quantity, note

`status` defaults to "available" and `quantity` defaults to 1 when blank.

Usage:
    python scripts/import_assets.py path/to/assets.csv
    python scripts/import_assets.py path/to/assets.csv --dry-run
    python scripts/import_assets.py path/to/assets.csv --update-existing
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path

# Make `backend/` importable regardless of where this script is invoked from.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from database import Base, SessionLocal, engine  # noqa: E402
from models import Asset, AssetStatus  # noqa: E402


REQUIRED_FIELDS = {"asset_no", "name"}
OPTIONAL_FIELDS = {"alias", "model", "location", "status", "quantity", "note"}


def parse_row(row: dict) -> dict:
    cleaned = {k: (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
    for field in REQUIRED_FIELDS:
        if not cleaned.get(field):
            raise ValueError(f"Missing required field '{field}' in row: {row}")

    status_value = cleaned.get("status") or "available"
    try:
        status = AssetStatus(status_value)
    except ValueError as exc:
        raise ValueError(
            f"Invalid status '{status_value}' (expected one of "
            f"{[s.value for s in AssetStatus]})"
        ) from exc

    quantity_value = cleaned.get("quantity") or "1"
    try:
        quantity = int(quantity_value)
    except ValueError as exc:
        raise ValueError(f"Invalid quantity '{quantity_value}'") from exc

    return {
        "asset_no": cleaned["asset_no"],
        "name": cleaned["name"],
        "alias": cleaned.get("alias") or None,
        "model": cleaned.get("model") or None,
        "location": cleaned.get("location") or None,
        "status": status,
        "quantity": quantity,
        "note": cleaned.get("note") or None,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Import assets from CSV")
    parser.add_argument("csv_path", type=Path, help="Path to the CSV file")
    parser.add_argument(
        "--dry-run", action="store_true", help="Parse and validate only; no DB writes."
    )
    parser.add_argument(
        "--update-existing",
        action="store_true",
        help="If asset_no exists, update the row instead of skipping.",
    )
    args = parser.parse_args()

    if not args.csv_path.is_file():
        print(f"error: file not found: {args.csv_path}", file=sys.stderr)
        return 2

    Base.metadata.create_all(bind=engine)

    inserted = updated = skipped = 0
    errors = 0

    with args.csv_path.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames is None or not REQUIRED_FIELDS.issubset(reader.fieldnames):
            print(
                f"error: CSV must include header columns: {sorted(REQUIRED_FIELDS)}",
                file=sys.stderr,
            )
            return 2

        session = SessionLocal()
        try:
            for idx, row in enumerate(reader, start=2):  # account for header line
                try:
                    payload = parse_row(row)
                except ValueError as exc:
                    print(f"line {idx}: {exc}", file=sys.stderr)
                    errors += 1
                    continue

                existing = (
                    session.query(Asset)
                    .filter(Asset.asset_no == payload["asset_no"])
                    .first()
                )

                if existing and not args.update_existing:
                    skipped += 1
                    continue

                if existing:
                    for k, v in payload.items():
                        setattr(existing, k, v)
                    updated += 1
                else:
                    session.add(Asset(**payload))
                    inserted += 1

            if args.dry_run:
                session.rollback()
                print("dry-run: rolled back changes")
            else:
                session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    print(
        f"done: inserted={inserted} updated={updated} skipped={skipped} errors={errors}"
    )
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
