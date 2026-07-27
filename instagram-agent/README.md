# Instagram Daily Poster

A tiny, dependency-light agent that posts one item to Instagram every day.
Runs entirely on **GitHub Actions cron** — no server, no PC required.

- Uses the **official Instagram Graph API** (safe, ToS-compliant, no ban risk)
- Reads posts from a queue folder committed to this repo
- Auto-archives each post to `posts/posted/` after it publishes

---

## How it works

```
instagram-agent/
├── post_daily.py                 # the script (Python 3.11, only `requests`)
├── requirements.txt
├── posts/
│   ├── queue/                    # future posts (alphabetical order)
│   │   └── 001-hello-world/
│   │       ├── caption.txt
│   │       └── image.jpg         # <-- you add this
│   └── posted/                   # auto-archived after publish
└── ...
```

Every day the workflow:

1. Picks the alphabetically first folder in `posts/queue/`.
2. Publishes it to Instagram via the Graph API (photo or Reel auto-detected).
3. Moves that folder into `posts/posted/` and pushes the change back so
   tomorrow's run picks up the next item.

If the queue is empty, the run exits cleanly with no error.

---

## One-time setup

### 1. Convert your Instagram account to Business or Creator

In the Instagram app: **Settings → Account → Switch to Professional Account**.

### 2. Connect it to a Facebook Page

Instagram → **Settings → Account → Linked accounts → Facebook** and link
a Page you own. (Create a Page first at [facebook.com/pages/create](https://www.facebook.com/pages/create) if you don't have one.)

### 3. Create a Meta app and get credentials

1. Go to [developers.facebook.com](https://developers.facebook.com/) → **My Apps → Create App** → type **Business**.
2. Add the **Instagram Graph API** product.
3. Open **Graph API Explorer** ([developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer/)).
4. Select your app, then generate a **User Access Token** with these permissions:
   - `pages_show_list`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`
   - `business_management`
5. **Get a long-lived Page Access Token** (60-day token — it can be refreshed):

   ```bash
   # Step A: exchange user token for a long-lived user token
   curl "https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<SHORT_USER_TOKEN>"

   # Step B: list your pages and grab the Page Access Token
   curl "https://graph.facebook.com/v20.0/me/accounts?access_token=<LONG_USER_TOKEN>"
   ```

   The `access_token` field of your Page in the Step B response is the
   long-lived Page token you'll use as `IG_ACCESS_TOKEN`.

6. **Find your Instagram Business Account ID:**

   ```bash
   curl "https://graph.facebook.com/v20.0/<PAGE_ID>?fields=instagram_business_account&access_token=<PAGE_TOKEN>"
   ```

   The returned `instagram_business_account.id` is your `IG_USER_ID`.

### 4. Add the secrets to this GitHub repo

**Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name        | Value                                               |
|--------------------|-----------------------------------------------------|
| `IG_USER_ID`       | Instagram Business Account ID from step 3.6        |
| `IG_ACCESS_TOKEN`  | Long-lived Page Access Token from step 3.5         |

Nothing else needed — the workflow builds the public media URL from
`github.repository` automatically.

### 5. (Only if your repo is private)

The Graph API must be able to `GET` your media file over the public
internet. If this repo is private, either:

- Make it public (simplest), **or**
- Set the repo secret `PUBLIC_MEDIA_BASE_URL` to another public host you
  upload the images to (S3, Cloudinary, imgbb, etc.) and adjust the
  workflow accordingly.

---

## Adding posts

For each post, add a folder inside `posts/queue/`:

```
posts/queue/002-my-second-post/
    caption.txt          # required, UTF-8 text
    image.jpg            # required (or image.png / video.mp4 for a Reel)
```

Folder names determine posting order — I recommend zero-padded numbers
(`003-…`, `004-…`) or dates (`2026-08-01-launch/`).

Media constraints (Instagram, as of 2026):

- **Photos**: JPEG/PNG, 320–1440 px wide, aspect ratio 4:5 to 1.91:1, ≤ 8 MB
- **Reels**: MP4 (H.264 + AAC), 3–900 s, ≤ 100 MB, 9:16 preferred

Commit and push — the next scheduled run will publish it.

---

## Schedule

The workflow (`.github/workflows/instagram-daily-post.yml`) runs at
**09:30 UTC every day** by default. Adjust the `cron:` line in the
workflow to change the time. Cron uses UTC — e.g. IST is UTC+5:30, so
`30 4 * * *` means 10:00 AM IST.

You can also trigger it manually any time from the **Actions** tab
(`Run workflow` button).

---

## Testing locally (optional)

```powershell
cd instagram-agent
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Copy .env.example -> .env and fill it in, then:
$env:IG_USER_ID = "..."
$env:IG_ACCESS_TOKEN = "..."
$env:PUBLIC_MEDIA_BASE_URL = "https://raw.githubusercontent.com/amolbankar291-netizen/theamolbankar/main/instagram-agent/posts/queue"
$env:DRY_RUN = "1"          # print what it would post, don't actually call the API
python post_daily.py
```

Set `DRY_RUN=1` to preview which folder / URL / caption would be posted
without hitting the Instagram API.

---

## Refreshing the access token

Long-lived Page Access Tokens don't expire *as long as they're used at
least every 60 days* — because this workflow uses the token daily, you're
covered. If it ever does expire (e.g. you pause posting for months),
repeat step 3.5 above and update the `IG_ACCESS_TOKEN` secret.
