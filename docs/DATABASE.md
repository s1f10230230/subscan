# データベース設定オプション

## 🎯 推奨：クラウドデータベース（簡単・確実）

ローカルPostgreSQLの設定が複雑な場合、以下のクラウドサービスを推奨します：

### 1. Supabase（推奨）⭐

**メリット：**
- 無料枠が充実（500MB、無制限プロジェクト）
- PostgreSQL完全互換
- 日本語サポート
- 設定が非常に簡単

**設定手順：**

1. **Supabase アカウント作成**
   - https://supabase.com/ にアクセス
   - 「Start your project」をクリック
   - GitHubアカウントでサインアップ

2. **新しいプロジェクト作成**
   - 「New Project」をクリック
   - Organization: 個人用の場合は既存を選択
   - Project name: `cardsync-dev`
   - Database Password: 強力なパスワードを設定
   - Region: `Northeast Asia (Tokyo)`（日本の場合）

3. **接続文字列を取得**
   - プロジェクト作成後、「Settings > Database」に移動
   - 「Connection string」セクションで「URI」を選択
   - パスワード部分 `[YOUR-PASSWORD]` を実際のパスワードに置換

4. **環境変数を更新**
   ```bash
   # .env.local を更新
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   ```

### 2. Vercel Postgres

**メリット：**
- Vercelと完全統合
- 無料枠あり
- デプロイ時の設定不要

**設定手順：**

1. **Vercel アカウント**
   - https://vercel.com/ でアカウント作成
   - GitHubと連携

2. **プロジェクトをVercelに連携**
   ```bash
   # Vercel CLI インストール
   npm install -g vercel

   # プロジェクトをVercelに連携
   vercel
   ```

3. **Postgres データベース追加**
   - Vercel Dashboard で該当プロジェクトを選択
   - 「Storage」タブ → 「Create Database」
   - 「Postgres」を選択
   - データベース名: `cardsync-db`

4. **環境変数を自動設定**
   - VercelがDATABASE_URLを自動設定
   - ローカル開発用に `vercel env pull .env.local`

### 3. PlanetScale（MySQL互換）

**設定が必要：**
- Prismaスキーマの`provider = "mysql"`に変更
- 一部のPostgreSQL固有機能の調整

## 🔧 ローカルPostgreSQL設定（上級者向け）

### Windows設定

1. **PostgreSQL サービス再起動**
   ```cmd
   # 管理者権限でコマンドプロンプト実行
   net stop postgresql-x64-17
   net start postgresql-x64-17
   ```

2. **パスワード設定**
   ```cmd
   # postgresql ユーザーでログイン
   psql -U postgres
   ```

3. **データベース作成**
   ```sql
   CREATE DATABASE cardsync;
   CREATE USER cardsync_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE cardsync TO cardsync_user;
   \q
   ```

### 環境変数更新

```bash
# .env.local
DATABASE_URL="postgresql://cardsync_user:secure_password@localhost:5432/cardsync"
DIRECT_URL="postgresql://cardsync_user:secure_password@localhost:5432/cardsync"
```

## 🚀 データベース初期化

どの方法を選んでも、以下のコマンドでスキーマとデータを設定：

```bash
# 1. スキーマをデータベースに適用
npm run db:push

# 2. 初期データ（カテゴリ、サブスクパターン）投入
npm run db:seed

# 3. データベース接続テスト
npm run db:test

# 4. Prisma Studio でデータ確認（オプション）
npm run db:studio
```

## 📊 推奨フロー

**初心者・迅速開発：**
1. Supabase を選択
2. 5分で設定完了
3. すぐに開発開始

**本格運用準備：**
1. Vercel Postgres を選択
2. CI/CD と統合
3. 本番環境と開発環境を分離

**学習・カスタマイズ重視：**
1. ローカル PostgreSQL
2. 詳細な制御が可能
3. セキュリティ学習に最適

## ⚡ クイックスタート（Supabase）

```bash
# 1. Supabase でプロジェクト作成（Web UI）
# 2. 接続文字列を .env.local に設定
# 3. データベース初期化
npm run db:push
npm run db:seed
npm run db:test

# 4. 開発開始！
npm run dev
```

どの方法を選択されますか？