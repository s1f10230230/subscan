# CardSync

クレジットカードの支出を自動で管理し、隠れたサブスクリプションを発見するWebアプリケーション

## 🎯 主な機能

- **📧 Gmail API連携**: クレジットカード利用通知を自動取得
- **🔍 サブスク自動検知**: Netflix、Spotify等のサブスクリプションを自動検出
- **💰 節約提案**: 使用していないサブスクの解約提案
- **📊 支出分析**: カテゴリ別・期間別の詳細な支出分析
- **💳 複数カード対応**: 複数のクレジットカードを一元管理

## 🛠 技術スタック

- **フロントエンド**: Next.js 14 (App Router), React 18, TypeScript
- **スタイリング**: Tailwind CSS, Radix UI
- **認証**: NextAuth.js (Google OAuth)
- **データベース**: PostgreSQL, Prisma ORM
- **外部API**: Gmail API, Stripe
- **インフラ**: Vercel

## 📋 必要な環境

- Node.js 18以上
- PostgreSQL
- Google Cloud Platform アカウント (Gmail API用)
- Stripe アカウント (課金機能用)

## 🚀 セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd credit_visual
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example` を参考に `.env.local` を作成：

```bash
cp .env.example .env.local
```

必要な環境変数：
- `DATABASE_URL`: PostgreSQL接続文字列
- `GOOGLE_CLIENT_ID`: Google OAuth クライアントID
- `GOOGLE_CLIENT_SECRET`: Google OAuth クライアントシークレット
- `NEXTAUTH_SECRET`: NextAuth用ランダム文字列

### 4. データベースのセットアップ

```bash
# Prisma マイグレーション実行
npm run db:push

# シードデータの投入
npm run db:seed
```

### 5. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションにアクセスできます。

## 📁 プロジェクト構造

```
├── app/                    # Next.js App Router
│   ├── (auth)/            # 認証画面
│   ├── (dashboard)/       # ダッシュボード画面
│   └── api/               # API Routes
├── components/            # React コンポーネント
│   ├── ui/               # 基本UIコンポーネント
│   ├── auth/             # 認証関連
│   ├── dashboard/        # ダッシュボード関連
│   └── email/            # メール連携関連
├── lib/                  # ユーティリティ・設定
├── prisma/               # データベーススキーマ
├── types/                # TypeScript型定義
└── styles/               # CSS
```

## 🔧 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 型チェック
npm run type-check

# リント
npm run lint

# テスト
npm run test

# データベース関連
npm run db:push      # スキーマをデータベースに適用
npm run db:generate  # Prisma クライアント生成
npm run db:studio    # Prisma Studio起動
npm run db:seed      # シードデータ投入
```

## 📊 実装フェーズ

### Phase 1: 基盤構築 ✅
- Next.js 14プロジェクトセットアップ
- Prismaスキーマとデータベース設定
- NextAuth.js認証システム
- 基本的なUI コンポーネント

### Phase 2: コア機能 🚧
- Gmail API連携
- メール解析エンジン
- クレジットカード管理
- 取引データ管理

### Phase 3: 高度な機能 📋
- サブスクリプション自動検知
- 支出分析・可視化
- 節約提案機能

### Phase 4: 課金・運用 📋
- Stripe課金システム
- プラン管理
- 運用監視

## 🎨 デザインシステム

- **カラーパレット**: Tailwind CSS デフォルト + カスタム
- **タイポグラフィ**: Inter フォント
- **コンポーネント**: Radix UI ベース
- **アイコン**: Lucide React

## 🔒 セキュリティ

- **認証**: NextAuth.js による安全な認証
- **暗号化**: メールトークンの暗号化保存
- **API保護**: ミドルウェアによる認証チェック
- **レート制限**: API リクエスト制限

## 📝 ライセンス

このプロジェクトはプライベートプロジェクトです。

## 🤝 コントリビューション

現在は個人開発プロジェクトのため、外部からのコントリビューションは受け付けておりません。

## 📞 サポート

質問や問題がある場合は、GitHubのIssuesをご利用ください。