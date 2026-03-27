import * as vscode from "vscode";

export class LovePreviewPanel {
  static currentPanel: LovePreviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private onDisposeCallback: (() => void) | undefined;

  static createOrShow(port: number): LovePreviewPanel {
    if (LovePreviewPanel.currentPanel) {
      LovePreviewPanel.currentPanel.panel.reveal(vscode.ViewColumn.Two);
      LovePreviewPanel.currentPanel.updateContent(port);
      return LovePreviewPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "lovePreview",
      "LÖVE2D Preview",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        portMapping: [{ webviewPort: port, extensionHostPort: port }],
      }
    );

    const instance = new LovePreviewPanel(panel, port);
    LovePreviewPanel.currentPanel = instance;
    return instance;
  }

  private constructor(panel: vscode.WebviewPanel, port: number) {
    this.panel = panel;
    this.updateContent(port);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.command === "error") {
          vscode.window.showErrorMessage(`LÖVE2D: ${message.text}`);
        }
      },
      null,
      this.disposables
    );
  }

  onDidDispose(callback: () => void): void {
    this.onDisposeCallback = callback;
  }

  /** Reload the iframe to pick up repackaged game files */
  reload(): void {
    this.panel.webview.postMessage({ command: "reload" });
  }

  private updateContent(port: number): void {
    this.panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
    }
    iframe {
      border: none;
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>
  <iframe
    id="game-frame"
    src="http://localhost:${port}/"
    allow="autoplay"
    sandbox="allow-scripts allow-same-origin">
  </iframe>
  <script>
    const vscode = acquireVsCodeApi();

    // Auto-focus iframe for keyboard input
    const iframe = document.getElementById('game-frame');
    iframe.addEventListener('load', () => {
      iframe.contentWindow.focus();
    });
    document.addEventListener('click', () => {
      iframe.contentWindow.focus();
    });

    // Forward errors from iframe
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'love-error') {
        vscode.postMessage({ command: 'error', text: event.data.message });
      }
      // Handle reload from extension
      if (event.data && event.data.command === 'reload') {
        const frame = document.getElementById('game-frame');
        frame.src = frame.src;
      }
    });
  </script>
</body>
</html>`;
  }

  dispose(): void {
    LovePreviewPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables.length = 0;
    this.onDisposeCallback?.();
  }
}
