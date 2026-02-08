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
      "command": "/opt/homebrew/bin/npx",
      "args": ["tsx", "/path/to/mcp-apps/main.ts", "--stdio"]
    }
  }
}
```

設定後、Claude Desktopを再起動してください。

### HTTP経由で接続する場合

```bash
pnpm serve
```

で起動後、`http://localhost:3001/mcp` に接続します。

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

| ツール名           | 説明                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `generate-palette` | ベースカラーからパレットを生成（complementary, analogous, triadic, monochromatic, split-complementary） |
| `check-contrast`   | 2色間のWCAGコントラスト比を計算                                                                         |

## 新しいMCP Appプロジェクトを作る

このプロジェクトの構成をベースに、新しいMCP Appをスキャフォールドするスキルを用意しています。

Claude Code上で以下を実行してください。

```
/skill dev_init-mcp-app my-new-app
```

サーバー・クライアント・Viteバンドル・デュアルトランスポート（stdio + HTTP）の雛形が一括生成されます。

## 技術スタック

- @modelcontextprotocol/ext-apps 1.0.1
- @modelcontextprotocol/sdk 1.26.0
- zod 4.x
- Vite + vite-plugin-singlefile
- TypeScript
