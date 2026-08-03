import fs from "node:fs";

const root = new URL("../", import.meta.url);
const publicDir = new URL("../public/", import.meta.url);
const publicDataDir = new URL("../public/data/", import.meta.url);

fs.mkdirSync(publicDataDir, { recursive: true });
fs.copyFileSync(new URL("index.html", root), new URL("index.html", publicDir));
fs.copyFileSync(new URL("data/courses.json", root), new URL("courses.json", publicDataDir));

console.log("Synced public site files.");
