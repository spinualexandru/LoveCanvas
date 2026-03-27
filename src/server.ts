import * as http from "http";
import * as fs from "fs";
import * as path from "path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".wasm": "application/wasm",
  ".css": "text/css",
  ".love": "application/octet-stream",
  ".lua": "text/plain",
  ".svg": "image/svg+xml",
};

export class GameServer {
  private server: http.Server | undefined;
  private runtimeDir: string;
  private gameLovePath: string = "";
  port: number = 0;

  constructor(extensionPath: string) {
    this.runtimeDir = path.join(extensionPath, "love-runtime");
  }

  start(gameLovePath: string): Promise<number> {
    this.gameLovePath = gameLovePath;
    if (this.server) {
      this.stop();
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) =>
        this.handleRequest(req, res)
      );

      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server!.address();
        if (addr && typeof addr === "object") {
          this.port = addr.port;
          resolve(this.port);
        } else {
          reject(new Error("Failed to get server address"));
        }
      });

      this.server.on("error", reject);
    });
  }

  updateGamePath(gameLovePath: string): void {
    this.gameLovePath = gameLovePath;
  }

  private handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): void {
    const urlStr = req.url || "/";
    const parsedUrl = new URL(urlStr, `http://localhost:${this.port}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (pathname === "/game.love") {
      this.serveFile(this.gameLovePath, res);
      return;
    }

    if (pathname === "/" || pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(this.generateIndexHtml());
      return;
    }

    // Serve from love-runtime directory
    const filePath = path.resolve(this.runtimeDir, pathname.slice(1));
    // Path traversal protection
    if (!filePath.startsWith(this.runtimeDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    this.serveFile(filePath, res);
  }

  private serveFile(filePath: string, res: http.ServerResponse): void {
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const stream = fs.createReadStream(filePath);
    stream.on("open", () => {
      res.writeHead(200, { "Content-Type": contentType });
      stream.pipe(res);
    });
    stream.on("error", () => {
      res.writeHead(404);
      res.end("Not found");
    });
  }

  private generateIndexHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="style.css">
<style>
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    background: #000;
    overflow: hidden;
  }
  #canvas {
    max-width: 100%;
    max-height: 100%;
    width: auto !important;
    height: auto !important;
  }
</style>
</head>
<body>
<canvas id="canvas"></canvas>
<div id="spinner" class="pending"></div>
<script src="player.js?g=game.love&c=1&n=1"></script>
</body>
</html>`;
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = undefined;
      this.port = 0;
    }
  }
}
