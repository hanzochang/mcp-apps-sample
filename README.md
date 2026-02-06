# Color Palette Generator MCP App

AIチャット内にインタラクティブなカラーパレット生成UIを埋め込むMCP Appです。

## セットアップ

```bash
pnpm install
```

## 起動方法

```bash
# UIビルド + サーバー起動
pnpm start
```

サーバーが `http://localhost:3001/mcp` で起動します。

### 開発モード（ホットリロード）

```bash
pnpm dev
```

## Claude Desktopへの接続

`~/Library/Application Support/Claude/claude_desktop_config.json` に以下を追加します。

```json
{
  "mcpServers": {
    "color-palette": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

設定後、Claude Desktopを再起動してください。

### cloudflaredトンネル経由（localhost接続が動かない場合）

```bash
npx cloudflared tunnel --url http://localhost:3001
```

表示されたURLで設定を置き換えてください。

```json
{
  "mcpServers": {
    "color-palette": {
      "url": "https://xxxx.trycloudflare.com/mcp"
    }
  }
}
```

## 動作確認（curl）

```bash
# initializeリクエスト
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'

# パレット生成
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"generate-palette","arguments":{"baseColor":"#3498db","paletteType":"analogous"}}}'
```

## ツール

| ツール名 | 説明 |
|---|---|
| `generate-palette` | ベースカラーからパレットを生成（complementary, analogous, triadic, monochromatic, split-complementary） |
| `check-contrast` | 2色間のWCAGコントラスト比を計算 |

## 技術スタック

- @modelcontextprotocol/ext-apps 1.0.1
- @modelcontextprotocol/sdk 1.26.0
- zod 4.x
- Vite + vite-plugin-singlefile
- TypeScript
