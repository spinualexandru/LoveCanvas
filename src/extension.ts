import * as vscode from "vscode";
import * as path from "path";
import { GameServer } from "./server";
import { packageGame, cleanupTemp } from "./gamePackager";
import { LovePreviewPanel } from "./webviewPanel";

let server: GameServer | undefined;
let hotReloadEnabled = false;
let fileWatcher: vscode.FileSystemWatcher | undefined;

function setRunning(value: boolean): void {
  vscode.commands.executeCommand("setContext", "love-preview.isRunning", value);
}

function setHotReload(value: boolean): void {
  hotReloadEnabled = value;
  vscode.commands.executeCommand(
    "setContext",
    "love-preview.hotReloadEnabled",
    value
  );
}

function startFileWatcher(extensionPath: string): void {
  if (fileWatcher) return;

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) return;

  fileWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceFolder, "**/*.{lua,png,jpg,wav,ogg,mp3,ttf,fnt,glsl}")
  );

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const reload = () => {
    if (!hotReloadEnabled || !server || server.port === 0) return;

    // Debounce rapid saves
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const workspaceDir = workspaceFolder.uri.fsPath;
      const lovePath = packageGame(workspaceDir);
      server!.updateGamePath(lovePath);
      LovePreviewPanel.currentPanel?.reload();
    }, 300);
  };

  fileWatcher.onDidChange(reload);
  fileWatcher.onDidCreate(reload);
  fileWatcher.onDidDelete(reload);
}

function stopFileWatcher(): void {
  fileWatcher?.dispose();
  fileWatcher = undefined;
}

async function play(extensionPath: string): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("LÖVE2D: No workspace folder open.");
    return;
  }

  const workspaceDir = workspaceFolder.uri.fsPath;
  const mainLua = path.join(workspaceDir, "main.lua");

  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(mainLua));
  } catch {
    vscode.window.showErrorMessage(
      "LÖVE2D: No main.lua found in workspace root."
    );
    return;
  }

  // Package game into .love file
  const lovePath = packageGame(workspaceDir);

  // Start HTTP server
  if (!server) {
    server = new GameServer(extensionPath);
  }

  if (server.port > 0) {
    server.updateGamePath(lovePath);
    LovePreviewPanel.currentPanel?.dispose();
  }

  const port = server.port > 0 ? server.port : await server.start(lovePath);

  setRunning(true);

  // Start file watcher for hot reload
  startFileWatcher(extensionPath);

  const panel = LovePreviewPanel.createOrShow(port);
  panel.onDidDispose(() => {
    stop();
  });
}

function stop(): void {
  LovePreviewPanel.currentPanel?.dispose();
  server?.stop();
  server = undefined;
  stopFileWatcher();
  setHotReload(false);
  cleanupTemp();
  setRunning(false);
}

export function activate(context: vscode.ExtensionContext): void {
  const extensionPath = context.extensionPath;

  context.subscriptions.push(
    vscode.commands.registerCommand("love-preview.play", () =>
      play(extensionPath)
    ),
    vscode.commands.registerCommand("love-preview.stop", () => stop()),
    vscode.commands.registerCommand("love-preview.restart", async () => {
      stop();
      await play(extensionPath);
    }),
    vscode.commands.registerCommand("love-preview.toggleHotReload", () => {
      setHotReload(!hotReloadEnabled);
      const state = hotReloadEnabled ? "enabled" : "disabled";
      vscode.window.showInformationMessage(`LÖVE2D: Hot reload ${state}`);
    })
  );
}

export function deactivate(): void {
  stop();
}
