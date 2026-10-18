// Reshape Vite's single-file output into an artifact page body: title first, no document wrappers.
import fs from "node:fs";
const src = fs.readFileSync(new URL("./dist/index.html", import.meta.url), "utf8");
let s = src.replace(/<!doctype html>/i, "").replace(/<\/?(html|head|body)[^>]*>/gi, "");
s = s.replace(/<title>.*?<\/title>/, "");
s = "<title>WorldFactory</title>\n" + s.trim() + "\n";
fs.writeFileSync(new URL("./dist/worldfactory.html", import.meta.url), s);
console.log("wrote", s.length, "bytes");
