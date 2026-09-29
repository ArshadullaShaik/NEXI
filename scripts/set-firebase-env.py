#!/usr/bin/env python3
"""Write Firebase service-account vars into .env.local from a downloaded JSON key file.

Usage:  python3 scripts/set-firebase-env.py /path/to/serviceAccountKey.json

Why a script instead of hand-editing .env.local: the private key is a single PEM block
containing real newlines, which no dotenv format can hold. The Firebase SDK expects it as one
line with literal backslash-n sequences, so the conversion has to be exact — a stray real
newline silently produces "Error signing custom token" or an unhelpful signature failure.
"""
import json
import re
import sys
from pathlib import Path

ENV = Path(__file__).resolve().parent.parent / ".env.local"

VARS = {
    "FIREBASE_PROJECT_ID": "project_id",
    "FIREBASE_CLIENT_EMAIL": "client_email",
    "FIREBASE_PRIVATE_KEY": "private_key",
}


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.is_file():
        print(f"error: {src} is not a file")
        return 1

    cred = json.loads(src.read_text())

    # One line, real newlines escaped as the two characters \ + n. Quoted so dotenv keeps it whole.
    key = cred["private_key"].replace("\n", "\\n")

    lines = []
    for env_name, json_field in VARS.items():
        value = key if json_field == "private_key" else cred[json_field]
        if not value:
            print(f"error: '{json_field}' missing from {src.name}")
            return 1
        lines.append(f'{env_name}="{value}"')

    block = "\n# Firebase service account (server) — set by scripts/set-firebase-env.py.\n" + "\n".join(lines) + "\n"

    existing = ENV.read_text() if ENV.exists() else ""
    # Replace any previous values for these vars so re-running is idempotent.
    for env_name in VARS:
        existing = re.sub(rf"^{env_name}=.*$", "", existing, flags=re.M)
    ENV.write_text(existing.rstrip("\n") + "\n" + block)

    # The JSON key file itself is a full database credential — make sure it cannot be committed.
    print(f"wrote {len(VARS)} vars to {ENV.name}")
    print(f"project_id = {cred['project_id']}")
    print(f"client_email = {cred['client_email']}")
    if src.parent != ENV.parent:
        print(f"\nWARNING: the key file at {src} is a full read/write database credential.")
        print("         Delete it once it is in .env.local, and never commit it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
