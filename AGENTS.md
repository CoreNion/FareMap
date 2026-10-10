# Fare-Map
このプロジェクトは、運賃を駅の運賃表のようにマップで可視化するウェブアプリです。

## 技術スタック
- Node.js
  - ユーティリティも含む
- Next.js v16
  - react v19

## ルール
基本的には各フレームワークのベストプラクティスに従います。(use context7)
実装のコメントは日本語で随時記述し、変更はこまめにコミットします。

### TypeScript
関数の宣言はは`const` + アロー関数方式を使用します。クラス(オブジェクト指向)は使用せずに、すべて関数型で実装します。

型定義ファイルは`types`ディレクトリ内に`*.ts`で入れます。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
