#!/usr/bin/env python3
"""Internal readiness check; never prints credentials or creates preview links."""

import os
import re
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
headers = {"Authorization": "Bearer " + os.getenv("API_TOKEN", "")}
deadline = time.monotonic() + 60
last_error = "not checked"
while time.monotonic() < deadline:
    try:
        with httpx.Client(timeout=5, trust_env=False) as client:
            response = client.get("http://127.0.0.1:8000/api/health", headers=headers)
            response.raise_for_status()
            assert response.json()["status"] == "ok"
            page = client.get("http://127.0.0.1:3000/")
            page.raise_for_status()
            assert "BountyScope" in page.text
            script = re.search(r'src="([^\"]+/_next/[^\"]+|/_next/[^\"]+)"', page.text)
            assert script, "Frontend JavaScript reference missing"
            client.get("http://127.0.0.1:3000" + script.group(1)).raise_for_status()
            response = client.get("http://127.0.0.1:3000/api/dashboard", headers=headers)
            response.raise_for_status()
            assert "projects" in response.json()
        print(
            "PASS: database/API, production frontend HTML/JavaScript, and authenticated frontend API proxy are ready."
        )
        break
    except (httpx.HTTPError, AssertionError, ValueError) as exc:
        last_error = type(exc).__name__
        time.sleep(1)
else:
    raise SystemExit("Readiness failed: " + last_error)
