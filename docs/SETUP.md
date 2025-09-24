# CardSync セットアップガイド

## 🚀 環境構築の手順

### 1. 基本セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env.local
```

### 2. データベースセットアップ

#### PostgreSQL インストール

**Windows:**
1. https://www.postgresql.org/download/windows/ からインストール
2. インストール時にパスワードを設定（例: `password`）
3. ポート: 5432（デフォルト）

**macOS (Homebrew):**
```bash
brew install postgresql
brew services start postgresql
createdb cardsync
```

**Linux (Ubuntu):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb cardsync
```

#### データベース初期化

```bash
# データベースにスキーマを適用
npm run db:push

# 初期データ投入（カテゴリ、サブスクパターン）
npm run db:seed

# データベース接続テスト
npm run db:test
```

### 3. Google OAuth設定 🔐

CardSyncでGmail連携を使用するには、Google Cloud Console での設定が必要です。

#### 3.1 Google Cloud Console プロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成
   - プロジェクト名: `cardsync-dev`
   - 組織: 個人の場合は「組織なし」

#### 3.2 Gmail API を有効化

1. **APIとサービス > ライブラリ** に移動
2. 「Gmail API」を検索して選択
3. **有効にする** をクリック

#### 3.3 OAuth認証情報作成

1. **APIとサービス > 認証情報** に移動
2. **認証情報を作成 > OAuth クライアント ID** を選択
3. **アプリケーションの種類**: ウェブアプリケーション
4. **名前**: `CardSync Dev`
5. **承認済みの JavaScript生成元**:
   ```
   http://localhost:3000
   ```
6. **承認済みのリダイレクト URI**:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
7. **作成** をクリック

#### 3.4 OAuth同意画面の設定

1. **OAuth同意画面** に移動
2. **外部** を選択（個人開発の場合）
3. 必須項目を入力:
   - **アプリ名**: CardSync
   - **ユーザーサポートメール**: 自分のメールアドレス
   - **デベロッパーの連絡先情報**: 自分のメールアドレス
4. **スコープ** を設定:
   ```
   ../auth/userinfo.email
   ../auth/userinfo.profile
   https://www.googleapis.com/auth/gmail.readonly
   ```
5. **テストユーザー** に自分のGmailアドレスを追加

#### 3.5 環境変数を設定

作成された認証情報を `.env.local` に追加:

```bash
# Google OAuth
GOOGLE_CLIENT_ID="your-client-id-here"
GOOGLE_CLIENT_SECRET="your-client-secret-here"

# Gmail API Key (省略可能 - OAuth で十分)
GMAIL_API_KEY="your-api-key-here"
```

### 4. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 でアプリケーションにアクセス

### 5. 動作確認

#### 5.1 基本機能テスト

1. **ホームページ**: http://localhost:3000
2. **ログインページ**: http://localhost:3000/signin
3. **ダッシュボード**: http://localhost:3000/dashboard (要ログイン)

#### 5.2 認証テスト

1. 「Googleで始める」ボタンをクリック
2. Google OAuth フローを完了
3. ダッシュボードにリダイレクトされることを確認

#### 5.3 データベーステスト

```bash
# データベース接続確認
npm run db:test

# Prisma Studio でデータ確認
npm run db:studio
```

## 🔧 トラブルシューティング

### データベース接続エラー

**Error: `ECONNREFUSED`**
```bash
# PostgreSQLサービス確認 (Windows)
# サービス > postgresql-x64-13 が実行中か確認

# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql
```

**Error: `database "cardsync" does not exist`**
```bash
# PostgreSQL に接続してデータベース作成
psql -U postgres
CREATE DATABASE cardsync;
\q
```

### OAuth設定エラー

**Error: `invalid_client`**
- Google Cloud Console でクライアントIDとシークレットを再確認
- リダイレクトURIが正確に設定されているか確認

**Error: `access_denied`**
- OAuth同意画面でテストユーザーとして自分のアカウントが追加されているか確認
- 必要なスコープ（Gmail readonly）が設定されているか確認

### Gmail API エラー

**Error: `insufficient permissions`**
- Google OAuth設定でGmail readonly スコープが含まれているか確認
- ユーザーがOAuth時にGmailアクセスを許可したか確認

## 🚀 次のステップ

環境構築が完了したら、以下の機能開発に進むことができます：

1. **Phase 2**: Gmail API連携とメール解析
2. **Phase 3**: サブスクリプション自動検知
3. **Phase 4**: 詳細な支出分析機能

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. **ログ確認**: ブラウザの開発者ツール > Console
2. **サーバーログ**: ターミナルの出力
3. **データベース状態**: `npm run db:studio` でデータ確認

技術的な問題については GitHub Issues で報告してください。