# Lossless original-asset preservation

The original model is stored as gzip solely for backup/transport. It is not a replacement runtime format.

Restore after checkout:

```sh
python3 scripts/restore-preserved-assets.py
```

The script uses only Python's standard library, checks the archive hash before decompression, checks the original hash before writing, and refuses to replace an existing different file. Running it again on an identical restored asset is safe.

- Runtime target: `public/models/porcelain-hero-blink-v1.glb`
- Original size: 13,700,928 bytes
- Original SHA-256: `57d7ee5b3c4e0b99eaadefb8095283bed44986beaa5a91c096dd7a0c514bf9c2`
- Original Git blob SHA: `d2ee073a4841a9e1ca798bca368dbe1eba3cecb3`
- Gzip size: 10,310,913 bytes
- Gzip SHA-256: `09f11f913f4853ea2050a007618ec607e7a6e4350403f7e4bdd91a68e542f3a1`

Local decompression and the restoration script were tested against the exact original bytes. GitHub archive-blob verification does not mean the runtime target exists in the repository. Application build, browser/mobile rendering, hosted authentication and Site publication were not part of this preservation task.
