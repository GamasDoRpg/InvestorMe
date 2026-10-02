const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const uiRoot = path.resolve(__dirname, "../ui");
const roots = {
  core: path.resolve(__dirname, "../core"),
  providers: path.resolve(__dirname, "../providers"),
};
const publicProviders = new Set([
  "/providers/UnavailableMarketDataProvider.mjs",
]);
http
  .createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    const group = pathname.split("/")[1];
    if (group === "providers" && !publicProviders.has(pathname)) {
      res.writeHead(404).end();
      return;
    }
    const root = Object.hasOwn(roots, group) ? roots[group] : uiRoot;
    const resource = Object.hasOwn(roots, group)
      ? pathname.slice(group.length + 1)
      : pathname;
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
