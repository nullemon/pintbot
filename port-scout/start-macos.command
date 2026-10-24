#!/bin/bash
set -eu
cd -- "$(dirname -- "$0")"
if command -v python3 >/dev/null 2>&1; then
    exec python3 app.py "$@"
elif command -v python >/dev/null 2>&1; then
    exec python app.py "$@"
else
    printf '%s\n' 'Python 3.10 or newer is required to run Port Scout.' 'Install it from https://www.python.org/downloads/ and run this file again.'
    exit 1
fi
