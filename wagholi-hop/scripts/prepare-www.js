const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const www = path.join(root, "www");

function rm(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

rm(www);
fs.mkdirSync(www, { recursive: true });

for (const file of ["index.html", "track.html", "manifest.webmanifest"]) {
  fs.copyFileSync(path.join(root, file), path.join(www, file));
}

for (const dir of ["css", "js", "assets"]) {
  copyDir(path.join(root, dir), path.join(www, dir));
}

console.log("Prepared www/ for Capacitor");
