// Local dev server: serves static files + api/*.js (mimics Vercel). Usage: GEMINI_API_KEY=... node server.js
const http = require("http"), fs = require("fs"), path = require("path");
const PORT = process.env.PORT || 3000;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    const name = path.basename(url.pathname).replace(/\.js$/, "");
    const file = path.join(__dirname, "api", name + ".js");
    if (name.startsWith("_") || !fs.existsSync(file)) { res.writeHead(404); return res.end("not found"); }
    let body = ""; req.on("data", (c) => (body += c));
    req.on("end", () => {
      req.body = body;
      res.status = (c) => ((res.statusCode = c), res);
      res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
      require(file)(req, res);
    });
    return;
  }
  const p = path.join(__dirname, url.pathname === "/" ? "index.html" : path.normalize(url.pathname));
  if (!p.startsWith(__dirname) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(PORT, () => console.log(`IssueBuddy on http://localhost:${PORT}`));
