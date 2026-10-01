const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const uiRoot = path.resolve(__dirname, "../ui");
const coreRoot = path.resolve(__dirname, "../core");
http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const isCore = pathname.startsWith("/core/");
    const root = isCore ? coreRoot : uiRoot;
    const resource = isCore ? pathname.slice(5) : pathname;
    const file = path.resolve(
      root,
      "." + (resource === "/" ? "/index.html" : resource),
    );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".css": "text/css",
          ".js": "text/javascript",
          ".mjs": "text/javascript",
        }[path.extname(file)] || "application/octet-stream",
      );
      res.end(data);
    });
  })
  .listen(Number(process.env.PORT) || 4173, "127.0.0.1", () =>
    console.log("InvestorMe preview: http://127.0.0.1:4173"),
  );
