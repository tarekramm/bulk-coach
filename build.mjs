import { cp, mkdir, rm } from "node:fs/promises";
const publicFiles=["index.html","app.js","config.js","style.css","icon.svg","manifest.webmanifest","sw.js","_routes.json","daily-reminder.ics"];
await rm("dist",{recursive:true,force:true});await mkdir("dist",{recursive:true});
for(const file of publicFiles)await cp(file,"dist/"+file);
console.log("Cloudflare Pages output ready in dist/");
