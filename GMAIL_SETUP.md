# Gmail API設定ガイド

このドキュメントでは、CardSyncでGmail API連携を有効にするための設定手順を説明します。

## 1. Google Cloud Consoleでの設定

### 1.1 新しいプロジェクトの作成
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成するか、既存のプロジェクトを選択
3. プロジェクト名を「CardSync」などに設定

### 1.2 Gmail APIの有効化
1. 左側のナビゲーションから「APIとサービス」→「ライブラリ」
2. 「Gmail API」を検索して選択
3. 「有効にする」ボタンをクリック

### 1.3 OAuth同意画面の設定
1. 「APIとサービス」→「OAuth同意画面」
2. ユーザータイプで「外部」を選択（テスト段階）
3. 必要な情報を入力：
   - アプリ名：CardSync
   - ユーザーサポートメール：あなたのメールアドレス
   - 承認済みドメイン：localhost（開発時）
   - デベロッパーの連絡先情報：あなたのメールアドレス

### 1.4 スコープの設定
1. 「スコープを追加または削除」をクリック
2. 以下のスコープを追加：
   - `../auth/gmail.readonly`
   - `openid`
   - `email`
   - `profile`

### 1.5 テストユーザーの追加（開発時）
1. 「テストユーザー」セクションで「ユーザーを追加」
2. 開発・テストに使用するGoogleアカウントのメールアドレスを追加

## 2. OAuth認証情報の作成

### 2.1 OAuthクライアントIDの作成
1. 「APIとサービス」→「認証情報」
2. 「認証情報を作成」→「OAuthクライアントID」
3. アプリケーションの種類：「ウェブアプリケーション」
4. 名前：「CardSync Web Client」
5. 承認済みのリダイレクトURIを追加：
   - 開発時：`http://localhost:3000/api/auth/callback/google`
   - 本番時：`https://your-domain.com/api/auth/callback/google`

### 2.2 認証情報の保存
1. 作成完了後、クライアントIDとクライアントシークレットをコピー
2. `.env.local`ファイルに設定：

```env
GOOGLE_CLIENT_ID="あなたのクライアントID"
GOOGLE_CLIENT_SECRET="あなたのクライアントシークレット"
```

## 3. 環境変数の設定

`.env.local`ファイル（または本番環境の環境変数）に以下を設定：

```env
# Database (SQLite for development)
DATABASE_URL="file:./dev.db"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-key-here"

# Google OAuth (Gmail API)
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"

# Encryption Key (32文字のランダム文字列)
ENCRYPTION_KEY="your-32-character-encryption-key-here"
```

### 環境変数の生成

暗号化キーを生成するには、以下のコマンドを使用：

```bash
# Node.jsで32文字のランダム文字列を生成
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# NextAuth Secretを生成
openssl rand -base64 32
```

## 4. テスト手順

### 4.1 開発サーバーの起動
```bash
npm run dev
```

### 4.2 Gmail連携のテスト
1. `http://localhost:3000/onboarding`にアクセス
2. 「Gmailアカウントを連携する」ボタンをクリック
3. Googleの認証画面で権限を許可
4. 連携完了後、設定画面でメール同期をテスト

## 5. トラブルシューティング

### 5.1 よくあるエラー

**Error: redirect_uri_mismatch**
- OAuth設定のリダイレクトURIが正しく設定されているか確認
- 開発時は `http://localhost:3000/api/auth/callback/google`

**Error: access_denied**
- Gmail APIが有効になっているか確認
- 必要なスコープが設定されているか確認
- テストユーザーとして登録されているか確認

**Error: invalid_client**
- クライアントIDとシークレットが正しく設定されているか確認

### 5.2 Gmail APIクォータ制限
- Gmail APIには1日あたりのリクエスト制限があります
- 開発時は十分な量ですが、本番運用時は注意が必要

### 5.3 トークンの有効期限
- アクセストークンは通常1時間で期限切れになります
- リフレッシュトークンを使用して自動更新されます
- エラーが発生した場合は再認証が必要になることがあります

## 6. 本番環境への移行

### 6.1 OAuth同意画面の公開
1. Google Cloud Consoleで「OAuth同意画面」
2. 「アプリを公開」をクリック
3. Googleの審査プロセスを完了（通常数日から数週間）

### 6.2 本番環境の設定
1. 本番ドメインをリダイレクトURIに追加
2. 環境変数を本番環境に設定
3. HTTPSを使用していることを確認

## 7. セキュリティベストプラクティス

1. **環境変数の管理**
   - `.env`ファイルをGitにコミットしない
   - 本番環境では安全な方法で環境変数を管理

2. **トークンの暗号化**
   - EmailAccountテーブルのトークンは自動的に暗号化されます
   - 暗号化キーを安全に管理

3. **最小権限の原則**
   - 必要最小限のGmailスコープ（readonly）のみを要求

4. **定期的な監査**
   - 不要になったアカウント連携を定期的に削除
   - ログを監視してセキュリティインシデントを検出

## サポート

設定に関する問題がある場合は、以下を確認してください：
1. 環境変数が正しく設定されているか
2. Gmail APIが有効になっているか
3. OAuth設定が正しいか
4. ネットワーク接続に問題がないか

それでも解決しない場合は、開発チームにお問い合わせください。