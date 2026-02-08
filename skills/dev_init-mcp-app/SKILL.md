---
name: dev_init-mcp-app
description: MCP App（AIチャット内埋め込みUI）プロジェクトをスキャフォールドする。サーバー・クライアント・Viteバンドル・デュアルトランスポートを一括セットアップ。
argument-hint: [プロジェクト名]
---

# MCP App スキャフォールドスキル

プロジェクト名を指定するだけで、MCP App（AIチャット内にインタラクティブUIを埋め込む拡張）の雛形を一括セットアップする。

## MCP App とは

MCP Apps は `@modelcontextprotocol/ext-apps` を使って、Claude Desktop などの AI チャットクライアント内にインタラクティブな HTML UI を埋め込む仕組み。サーバー側でツールとリソースを登録し、クライアント側（HTML）から `App` クラスを通じて双方向通信する。

## 技術スタック

| カテゴリ | 技術 |
| --- | --- |
| MCP SDK | @modelcontextprotocol/sdk ^1.24.0 |
| MCP Apps | @modelcontextprotocol/ext-apps ^1.0.0 |
| バリデーション | zod ^4.0.0（v4必須） |
| UIバンドル | Vite + vite-plugin-singlefile |
| トランスポート | stdio（Claude Desktop） + HTTP（開発/テスト） |
| 言語 | TypeScript（ESNext, bundler moduleResolution） |
| パッケージ管理 | pnpm |

## ディレクトリ構成

```
{project-name}/
├── server.ts              # MCPサーバー（registerAppTool + registerAppResource）
├── main.ts                # エントリーポイント（stdio + HTTP デュアルトランスポート）
├── mcp-app.html           # UIエントリーポイント
├── src/
│   ├── mcp-app.ts         # クライアントロジック（App クラス）
│   └── global.css         # スタイル
├── dist/                  # ビルド出力（gitignore対象）
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .gitignore
```

## 重要な注意事項（ハマりポイント）

### 1. inputSchema は Zod スキーマを使う（JSON Schema ではない）

`registerAppTool` の `inputSchema` には **Zod スキーマ** を渡す。JSON Schema 形式を渡すと `v3Schema.safeParseAsync is not a function` エラーが出る。

```typescript
// OK
inputSchema: {
  myParam: z.string().describe("説明"),
  myEnum: z.enum(["a", "b", "c"]),
}

// NG（エラーになる）
inputSchema: {
  type: "object",
  properties: { myParam: { type: "string" } }
}
```

### 2. zod v4 が必須

MCP SDK 1.26.0 は zod v4 を peer dependency として要求する。v3 では動作しない。

### 3. Express 5 ではなく Node.js http を使う

Express 5 はボディストリームを消費してしまい、`transport.handleRequest(req, res)` が正しく動作しない。Node.js 標準の `http.createServer` を使えば問題なし。

### 4. Claude Desktop は stdio トランスポートで接続する

Claude Desktop の設定で `"url"` 形式は動作しない場合がある。`"command"` + `"args"` 形式で stdio トランスポートを使う。

---

## ユーザー確認

以下の設定を対話で取得する。`$ARGUMENTS` にプロジェクト名が渡されていればそれを使う。

| 項目 | デフォルト値 | 質問するか |
| --- | --- | --- |
| プロジェクト名 | `$ARGUMENTS` から取得 | なければ質問 |
| ターゲットディレクトリ | `./{project-name}` | 確認のみ |
| サーバー名（表示用） | プロジェクト名から生成 | 確認のみ |
| HTTPポート | `3001` | 確認のみ |

---

## Phase 1: ディレクトリ作成

```bash
mkdir -p {target-dir}/src
mkdir -p {target-dir}/dist
```

---

## Phase 2: 設定ファイル作成

以下のファイルをすべて `Write` ツールで作成する。テンプレート内の `{project-name}`, `{server-name}`, `{port}` をユーザー確認値で置換すること。

### package.json

```json
{
  "name": "{project-name}",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build:ui": "cross-env INPUT=mcp-app.html vite build",
    "build": "pnpm build:ui",
    "serve": "tsx main.ts",
    "start": "pnpm build && pnpm serve",
    "dev": "cross-env NODE_ENV=development concurrently \"pnpm build:ui -- --watch\" \"tsx --watch main.ts\""
  },
  "dependencies": {
    "@modelcontextprotocol/ext-apps": "^1.0.0",
    "@modelcontextprotocol/sdk": "^1.24.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "concurrently": "^9.2.1",
    "cross-env": "^10.1.0",
    "prettier": "^3.4.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vite-plugin-singlefile": "^2.3.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "server.ts", "main.ts"]
}
```

### vite.config.ts

```typescript
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error("INPUT environment variable is not set");
}

const isDevelopment = process.env.NODE_ENV === "development";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {
      input: INPUT,
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
```

### .gitignore

```gitignore
node_modules/
dist/
.DS_Store
```

---

## Phase 3: サーバーファイル作成

### server.ts

リソースURI は `ui://{project-name}/mcp-app.html` とする。

```typescript
import fs from "node:fs";
import path from "node:path";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const DIST_DIR = path.join(import.meta.dirname, "dist");
const RESOURCE_URI = "ui://{project-name}/mcp-app.html";

export const createServer = (): McpServer => {
  const server = new McpServer({
    name: "{server-name}",
    version: "1.0.0",
  });

  // --- ツール登録 ---
  // TODO: ここにツールを追加する
  // inputSchema には Zod スキーマを使うこと（JSON Schema ではない）
  registerAppTool(
    server,
    "hello",
    {
      title: "Hello",
      description: "Returns a greeting message.",
      inputSchema: {
        name: z.string().describe("Name to greet"),
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ name }) => {
      return {
        content: [
          { type: "text", text: JSON.stringify({ message: `Hello, ${name}!` }) },
        ],
      };
    },
  );

  // --- リソース登録（UI HTML） ---
  registerAppResource(
    server,
    RESOURCE_URI,
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.promises.readFile(
        path.join(DIST_DIR, "mcp-app.html"),
        "utf-8",
      );
      return {
        contents: [
          { uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  return server;
};
```

### main.ts

stdio と HTTP のデュアルトランスポート。Claude Desktop は `--stdio` フラグで接続する。

```typescript
import http from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const startStdioServer = async () => {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

const startHttpServer = () => {
  const httpServer = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, Mcp-Session-Id",
    );
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Type, Mcp-Session-Id",
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    try {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      res.on("close", async () => {
        await transport.close();
        await server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP request error:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          }),
        );
      }
    }
  });

  const port = parseInt(process.env.PORT ?? "{port}", 10);

  httpServer.listen(port, () => {
    console.log(`MCP server listening on http://localhost:${port}/mcp`);
  });

  const shutdown = () => {
    console.log("Shutting down...");
    httpServer.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

if (process.argv.includes("--stdio")) {
  startStdioServer().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  startHttpServer();
}
```

---

## Phase 4: クライアントファイル作成

### mcp-app.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>{server-name}</title>
    <link rel="stylesheet" href="/src/global.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/mcp-app.ts"></script>
  </body>
</html>
```

### src/mcp-app.ts

最小構成のクライアントロジック。`App` クラスで接続し、サーバーツールを呼び出す雛形。

```typescript
import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ===== App Setup =====
const app = new App({ name: "{server-name}", version: "1.0.0" });

// ===== Build UI =====
const buildUI = () => {
  const appEl = document.getElementById("app")!;
  appEl.innerHTML = "";

  const container = document.createElement("div");
  container.className = "app";

  const header = document.createElement("div");
  header.className = "header";
  const h1 = document.createElement("h1");
  h1.textContent = "{server-name}";
  const subtitle = document.createElement("p");
  subtitle.textContent = "MCP App is running";
  header.appendChild(h1);
  header.appendChild(subtitle);

  const content = document.createElement("div");
  content.className = "content";
  content.id = "content";
  content.textContent = "Ready";

  container.appendChild(header);
  container.appendChild(content);
  appEl.appendChild(container);
};

// ===== App Event Handlers =====
app.ontoolresult = (result: CallToolResult) => {
  const textContent = result.content?.find((c: any) => c.type === "text");
  if (textContent && "text" in textContent) {
    try {
      const data = JSON.parse(textContent.text);
      const contentEl = document.getElementById("content");
      if (contentEl) {
        contentEl.textContent = JSON.stringify(data, null, 2);
      }
    } catch {
      // ignore
    }
  }
};

app.ontoolinput = (_input: any) => {
  // ホストからのツール入力を処理する
};

app.onhostcontextchanged = (ctx: any) => {
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
  if (ctx?.styles) applyHostStyleVariables(ctx.styles);
  if (ctx?.fonts) applyHostFonts(ctx.fonts);
};

app.onerror = (error: Error) => {
  console.error("MCP App error:", error);
};

// ===== Initialize =====
buildUI();

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
  if (ctx?.styles) applyHostStyleVariables(ctx.styles);
  if (ctx?.fonts) applyHostFonts(ctx.fonts);
});
```

### src/global.css

ライト/ダークテーマ対応の最小CSS。

```css
:root {
  --bg-primary: #f8f9fa;
  --bg-secondary: #ffffff;
  --text-primary: #1a1a2e;
  --text-secondary: #555770;
  --border-color: #e2e4e9;
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
  --radius-md: 12px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #0f0f1a;
    --bg-secondary: #1a1a2e;
    --text-primary: #e8e8f0;
    --text-secondary: #a0a0b8;
    --border-color: #2e2e4a;
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px 48px;
}

.header {
  text-align: center;
  margin-bottom: 32px;
}

.header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 6px;
}

.header p {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px 24px;
  box-shadow: var(--shadow-sm);
  font-family: "SF Mono", SFMono-Regular, Consolas, monospace;
  font-size: 0.85rem;
  white-space: pre-wrap;
  word-break: break-all;
}
```

---

## Phase 5: コマンド実行

### Step 1: pnpm install

```bash
cd {target-dir} && pnpm install
```

**失敗時**: エラー報告して停止。

### Step 2: UI ビルド

```bash
cd {target-dir} && pnpm build:ui
```

**失敗時**: エラー報告して停止。

### Step 3: 動作確認（HTTP）

```bash
cd {target-dir} && tsx main.ts &
sleep 2
curl -s -X POST http://localhost:{port}/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
kill %1 2>/dev/null || true
```

**失敗時**: 警告を出すが成功扱い。

### Step 4: prettier

```bash
cd {target-dir} && pnpm prettier --write .
```

---

## Phase 6: レポート出力

以下の情報をユーザーに表示する。

```
============================================
  {project-name} セットアップ完了
============================================

作成ファイル:
  server.ts          - MCPサーバー（ツール・リソース登録）
  main.ts            - エントリーポイント（stdio + HTTP）
  mcp-app.html       - UIエントリーポイント
  src/mcp-app.ts     - クライアントロジック
  src/global.css     - スタイル（ライト/ダーク対応）
  package.json       - 依存関係
  tsconfig.json      - TypeScript設定
  vite.config.ts     - Viteビルド設定
  .gitignore         - Git除外設定

起動方法:
  開発:   pnpm dev
  本番:   pnpm start
  HTTP:   pnpm serve（http://localhost:{port}/mcp）

Claude Desktop 接続:
  ~/Library/Application Support/Claude/claude_desktop_config.json に追加:

  {
    "mcpServers": {
      "{project-name}": {
        "command": "/opt/homebrew/bin/npx",
        "args": ["tsx", "{absolute-path}/main.ts", "--stdio"]
      }
    }
  }

次のステップ:
  1. server.ts にツールを追加（registerAppTool）
  2. src/mcp-app.ts にUI実装
  3. src/global.css でスタイリング
```

---

## エラーハンドリング方針

| 状況 | 対応 |
| --- | --- |
| pnpm install 失敗 | エラー報告して停止 |
| UIビルド失敗 | エラー報告して停止 |
| 動作確認失敗 | 警告を出すが成功扱い |
| prettier 失敗 | スキップして警告 |

---

## 注意事項

- import 文には `.js` 拡張子を付ける（server.ts の import は bundler 解決なので不要だが、main.ts では必要）
- 関数はすべてアロー関数で定義する
- エクスポートする関数を優先して上の行に記述する
- `inputSchema` には必ず **Zod スキーマ**を使う（JSON Schema ではない）
- zod は **v4** を使う（MCP SDK の peer dependency）
- HTTP サーバーは **Node.js 標準 `http.createServer`** を使う（Express 5 は NG）
- `StreamableHTTPServerTransport` には `sessionIdGenerator: undefined` を渡す
- UIは `vite-plugin-singlefile` で単一HTMLにバンドルする
- Claude Desktop 接続は `command` + `args` 形式（`url` 形式は使わない）

$ARGUMENTS
