# Add your image here

Drop a single **`image.jpg`** (or `image.jpeg` / `image.png`) in this folder.
For a Reel, drop **`video.mp4`** instead of an image.

Then delete this placeholder file, commit, and push. The next scheduled
run will publish this folder and move it to `posts/posted/`.

Instagram constraints (as of 2026):

- Photos: JPEG/PNG, 320\u20131440px wide, aspect ratio 4:5 to 1.91:1, < 8 MB
- Reels: MP4, 3\u2013900 s, aspect ratio 9:16 preferred, < 100 MB

The media file must be reachable at a public HTTPS URL. This repo is set up
so `raw.githubusercontent.com/<owner>/<repo>/main/instagram-agent/posts/queue/...`
serves the image directly (works when the repo is public).
