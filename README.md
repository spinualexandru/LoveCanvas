# LoveCanvas

Run [LOVE2D](https://love2d.org/) games directly inside VS Code. No external windows, no native runtime needed -- your game runs in a split panel via WebAssembly.

## Features

- **Inline preview** -- your LOVE2D game runs in a VS Code webview panel, right next to your code
- **One-click play** -- open `main.lua` and hit the play button in the editor title bar
- **Hot reload** -- toggle auto-reload so the game restarts whenever you save a file
- **Zero setup** -- no need to install LOVE2D on your machine; the extension bundles a WASM runtime

## Usage

1. Open a folder containing a LOVE2D project (must have `main.lua` at the root)
2. Open `main.lua` in the editor
3. Click the **Play** button in the editor title bar
4. Your game appears in a split panel

### Commands

| Command | Description |
|---------|-------------|
| `LoveCanvas: Play Game` | Package and run the game |
| `LoveCanvas: Stop Game` | Stop the running game |
| `LoveCanvas: Restart Game` | Re-package and restart |
| `LoveCanvas: Toggle Hot Reload` | Auto-restart on file save |

### Hot Reload

Click the sync icon in the editor title bar while the game is running. When enabled, saving any `.lua`, image, audio, font, or shader file will automatically re-package and reload the game.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `love-preview.loveVersion` | `11.5` | LOVE2D runtime version (11.3, 11.4, or 11.5) |

## Limitations

- Canvas size cannot be changed dynamically from game code at runtime
- LOVE threads and FFI are not available (Emscripten limitation)
- Some shaders may behave differently due to WebGL vs desktop OpenGL
- Audio may require clicking the game panel first (browser autoplay policy)

## Credits

Powered by [love.js](https://github.com/2dengine/love.js) by 2dengine -- the Emscripten/WASM port of LOVE2D.

## License

MIT
