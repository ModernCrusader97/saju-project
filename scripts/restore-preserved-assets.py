#!/usr/bin/env python3
"""Restore the one losslessly archived original SaJu asset. Never overwrite a mismatch."""
from pathlib import Path
import gzip
import hashlib
import sys

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "preservation-archives/porcelain-hero-blink-v1.glb.gz"
TARGET = ROOT / "public/models/porcelain-hero-blink-v1.glb"
ARCHIVE_SHA256 = "09f11f913f4853ea2050a007618ec607e7a6e4350403f7e4bdd91a68e542f3a1"
ORIGINAL_SHA256 = "57d7ee5b3c4e0b99eaadefb8095283bed44986beaa5a91c096dd7a0c514bf9c2"
ORIGINAL_BYTES = 13700928

def digest(data):
    return hashlib.sha256(data).hexdigest()

def main():
    compressed = ARCHIVE.read_bytes()
    if digest(compressed) != ARCHIVE_SHA256:
        raise SystemExit("Archive hash mismatch; no file was written.")
    restored = gzip.decompress(compressed)
    if len(restored) != ORIGINAL_BYTES or digest(restored) != ORIGINAL_SHA256:
        raise SystemExit("Restored data mismatch; no file was written.")
    if TARGET.exists():
        if TARGET.is_file() and digest(TARGET.read_bytes()) == ORIGINAL_SHA256:
            print("Original asset is already restored and hash-verified.")
            return
        raise SystemExit("Target already exists with different content; refusing to overwrite it.")
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    with TARGET.open("xb") as stream:
        stream.write(restored)
    if digest(TARGET.read_bytes()) != ORIGINAL_SHA256:
        raise SystemExit("Post-write verification failed.")
    print("Restored public/models/porcelain-hero-blink-v1.glb (13,700,928 bytes); SHA-256 verified.")

if __name__ == "__main__":
    main()
