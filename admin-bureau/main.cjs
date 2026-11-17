const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const avecRelais = process.argv.includes("--relais");
app.whenReady().then(() => {
  if (avecRelais) session.defaultSession.webRequest.onHeadersReceived({ urls: ["https://*/*"] }, (d, cb) => {
    if (d.webContentsId === undefined) return cb({});
    const h = {};
    for (const [k, v] of Object.entries(d.responseHeaders || {})) if (!k.toLowerCase().startsWith("access-control-")) h[k] = v;
    h["Access-Control-Allow-Origin"] = ["*"]; h["Access-Control-Allow-Methods"] = ["GET, POST, PUT, PATCH, DELETE, OPTIONS"]; h["Access-Control-Allow-Headers"] = ["Authorization, Content-Type, Content-Range"]; h["Access-Control-Expose-Headers"] = ["*"];
    cb({ responseHeaders: h });
  });
  const w = new BrowserWindow({ show: false });
  w.on("page-title-updated", (_e, t) => { if (t.startsWith("FIN:")) { console.log((avecRelais ? "AVEC relais: " : "SANS relais: ") + t.slice(4)); app.quit(); } });
  w.loadFile(path.join(__dirname, "page.html"));
  setTimeout(() => { console.log("delai depasse"); app.quit(); }, 40000);
});
