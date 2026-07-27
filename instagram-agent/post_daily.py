"""
Instagram Daily Poster — official Instagram Graph API.

Reads the next queued post from ``posts/queue/`` (alphabetically first
folder), publishes it to Instagram, then moves the folder to
``posts/posted/`` so the next run picks up the next item.

Each queue folder must contain:
  - ``caption.txt``  — the post caption (UTF-8 text)
  - Exactly one media file named ``image.jpg`` / ``image.jpeg`` /
    ``image.png`` (photo) OR ``video.mp4`` (Reel)

Required environment variables:
  IG_USER_ID              Instagram Business/Creator account ID (numeric)
  IG_ACCESS_TOKEN         Long-lived Page access token with the
                          ``instagram_content_publish`` permission
  PUBLIC_MEDIA_BASE_URL   Public HTTPS base URL for the queue folder.
                          Instagram fetches media from this URL, so the
                          repo must be public (or the URL must otherwise
                          be reachable by Instagram).

Optional:
  GRAPH_API_VERSION       Defaults to ``v20.0``.
  DRY_RUN                 If ``1``/``true``, prints what it would do
                          and skips the API calls + the git move.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Optional

import requests

ROOT = Path(__file__).resolve().parent
QUEUE_DIR = ROOT / "posts" / "queue"
POSTED_DIR = ROOT / "posts" / "posted"

PHOTO_EXTS = {".jpg", ".jpeg", ".png"}
VIDEO_EXTS = {".mp4", ".mov"}

GRAPH_VERSION = os.environ.get("GRAPH_API_VERSION", "v20.0")
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_VERSION}"


def log(msg: str) -> None:
    print(f"[ig-poster] {msg}", flush=True)


def die(msg: str, code: int = 1) -> None:
    log(f"ERROR: {msg}")
    sys.exit(code)


def env(name: str, required: bool = True) -> Optional[str]:
    val = os.environ.get(name, "").strip()
    if required and not val:
        die(f"Missing required environment variable: {name}")
    return val or None


def is_truthy(val: Optional[str]) -> bool:
    return (val or "").strip().lower() in {"1", "true", "yes", "y", "on"}


def pick_next_post() -> Optional[Path]:
    if not QUEUE_DIR.is_dir():
        return None
    folders = sorted(p for p in QUEUE_DIR.iterdir() if p.is_dir() and not p.name.startswith("."))
    for folder in folders:
        if (folder / "caption.txt").is_file() and _find_media(folder) is not None:
            return folder
    return None


def _find_media(folder: Path) -> Optional[Path]:
    for p in sorted(folder.iterdir()):
        if p.is_file() and p.suffix.lower() in (PHOTO_EXTS | VIDEO_EXTS):
            return p
    return None


def _create_photo_container(ig_user_id: str, token: str, image_url: str, caption: str) -> str:
    resp = requests.post(
        f"{GRAPH_BASE}/{ig_user_id}/media",
        data={"image_url": image_url, "caption": caption, "access_token": token},
        timeout=60,
    )
    return _extract_id(resp, "create photo container")


def _create_reel_container(ig_user_id: str, token: str, video_url: str, caption: str) -> str:
    resp = requests.post(
        f"{GRAPH_BASE}/{ig_user_id}/media",
        data={
            "media_type": "REELS",
            "video_url": video_url,
            "caption": caption,
            "share_to_feed": "true",
            "access_token": token,
        },
        timeout=60,
    )
    return _extract_id(resp, "create reel container")


def _extract_id(resp: requests.Response, action: str) -> str:
    try:
        data = resp.json()
    except ValueError:
        die(f"{action}: non-JSON response ({resp.status_code}): {resp.text[:400]}")
    if resp.status_code >= 400 or "id" not in data:
        die(f"{action} failed: {json.dumps(data)[:800]}")
    return data["id"]


def _wait_ready(creation_id: str, token: str, is_video: bool) -> None:
    # Photos are usually FINISHED almost immediately; Reels can take a while.
    deadline = time.time() + (600 if is_video else 120)
    delay = 3
    while time.time() < deadline:
        resp = requests.get(
            f"{GRAPH_BASE}/{creation_id}",
            params={"fields": "status_code,status", "access_token": token},
            timeout=30,
        )
        try:
            data = resp.json()
        except ValueError:
            die(f"status poll: non-JSON response: {resp.text[:400]}")
        status = data.get("status_code") or data.get("status", "")
        log(f"container {creation_id} status: {status}")
        if status == "FINISHED":
            return
        if status in {"ERROR", "EXPIRED"}:
            die(f"container failed: {json.dumps(data)}")
        time.sleep(delay)
        delay = min(delay + 2, 15)
    die(f"container {creation_id} did not reach FINISHED before timeout")


def _publish(ig_user_id: str, token: str, creation_id: str) -> str:
    resp = requests.post(
        f"{GRAPH_BASE}/{ig_user_id}/media_publish",
        data={"creation_id": creation_id, "access_token": token},
        timeout=60,
    )
    return _extract_id(resp, "publish media")


def move_to_posted(folder: Path) -> Path:
    POSTED_DIR.mkdir(parents=True, exist_ok=True)
    dest = POSTED_DIR / folder.name
    if dest.exists():
        dest = POSTED_DIR / f"{folder.name}-{int(time.time())}"
    shutil.move(str(folder), str(dest))
    return dest


def main() -> int:
    ig_user_id = env("IG_USER_ID")
    token = env("IG_ACCESS_TOKEN")
    base_url = env("PUBLIC_MEDIA_BASE_URL")
    dry_run = is_truthy(os.environ.get("DRY_RUN"))

    post = pick_next_post()
    if post is None:
        log("Queue is empty — nothing to post. Exiting cleanly.")
        return 0

    media = _find_media(post)
    caption = (post / "caption.txt").read_text(encoding="utf-8").strip()
    is_video = media.suffix.lower() in VIDEO_EXTS
    media_url = f"{base_url.rstrip('/')}/{post.name}/{media.name}"

    log(f"Posting folder:  {post.name}")
    log(f"  media file:    {media.name} ({'video/reel' if is_video else 'photo'})")
    log(f"  media URL:     {media_url}")
    log(f"  caption ({len(caption)} chars): {caption[:120]}{'...' if len(caption) > 120 else ''}")

    if dry_run:
        log("DRY_RUN=1 — skipping API calls and archival.")
        return 0

    if is_video:
        creation_id = _create_reel_container(ig_user_id, token, media_url, caption)
    else:
        creation_id = _create_photo_container(ig_user_id, token, media_url, caption)
    log(f"Created container: {creation_id}")

    _wait_ready(creation_id, token, is_video)
    media_id = _publish(ig_user_id, token, creation_id)
    log(f"Published! Media ID: {media_id}")

    dest = move_to_posted(post)
    log(f"Archived queue folder -> {dest.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
