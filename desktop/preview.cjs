const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../ui");
http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const file = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
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
        { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" }[
          path.extname(file)
        ] || "application/octet-stream",
      );
      res.end(data);
    });
  })
  .listen(Number(process.env.PORT) || 4173, "127.0.0.1", () =>
    console.log("InvestorMe preview: http://127.0.0.1:4173"),
  );
