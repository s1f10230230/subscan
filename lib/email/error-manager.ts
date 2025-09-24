/**
 * Email Processing Error Management System
 * Handles error classification, logging, and retry logic
 */

import { prisma } from '@/lib/prisma';

export enum EmailProcessingErrorType {
  // API/Network errors
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  GMAIL_API_ERROR = 'GMAIL_API_ERROR',

  // Parsing errors
  AMOUNT_EXTRACTION_FAILED = 'AMOUNT_EXTRACTION_FAILED',
  MERCHANT_PARSING_FAILED = 'MERCHANT_PARSING_FAILED',
  UNKNOWN_EMAIL_FORMAT = 'UNKNOWN_EMAIL_FORMAT',
  MULTIPLE_AMOUNTS_FOUND = 'MULTIPLE_AMOUNTS_FOUND',
  PATTERN_MATCH_FAILED = 'PATTERN_MATCH_FAILED',

  // Data validation errors
  INVALID_AMOUNT_FORMAT = 'INVALID_AMOUNT_FORMAT',
  UNSUPPORTED_CURRENCY = 'UNSUPPORTED_CURRENCY',
  INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',

  // Database errors
  DATABASE_SAVE_FAILED = 'DATABASE_SAVE_FAILED',
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DUPLICATE_RECORD_ERROR = 'DUPLICATE_RECORD_ERROR',

  // Processing errors
  PROCESSING_TIMEOUT = 'PROCESSING_TIMEOUT',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR'
}

export interface EmailProcessingError {
  id?: string;
  type: EmailProcessingErrorType;
  message: string;
  emailId?: string;
  emailSubject?: string;
  emailSender?: string;
  context?: Record<string, any>;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isRetryable: boolean;
  retryCount?: number;
  maxRetries?: number;
  occurredAt: Date;
  resolvedAt?: Date;
  userId?: string;
  processingJobId?: string;
}

export class EmailErrorManager {
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 5000]; // milliseconds

  /**
   * エラーログの記録
   */
  async logError(
    error: Partial<EmailProcessingError>,
    emailData?: {
      id: string;
      subject: string;
      sender: string;
    },
    context?: Record<string, any>
  ): Promise<string> {
    try {
      const errorRecord: EmailProcessingError = {
        type: error.type || EmailProcessingErrorType.UNEXPECTED_ERROR,
        message: error.message || 'Unknown error',
        emailId: emailData?.id || error.emailId,
        emailSubject: emailData?.subject?.substring(0, 255) || error.emailSubject,
        emailSender: emailData?.sender?.substring(0, 255) || error.emailSender,
        context: context || error.context,
        severity: error.severity || this.determineSeverity(error.type!),
        isRetryable: error.isRetryable ?? this.isRetryableError(error.type!),
        retryCount: error.retryCount || 0,
        maxRetries: error.maxRetries || this.MAX_RETRY_ATTEMPTS,
        occurredAt: error.occurredAt || new Date(),
        userId: error.userId,
        processingJobId: error.processingJobId
      };

      // データベースに保存
      const saved = await this.saveErrorToDatabase(errorRecord);

      // 重要なエラーの場合はアラート送信
      if (errorRecord.severity === 'CRITICAL') {
        await this.sendCriticalErrorAlert(errorRecord);
      }

      // エラー統計の更新
      await this.updateErrorStatistics(errorRecord);

      return saved.id!;

    } catch (saveError) {
      console.error('Failed to log error:', saveError);
      // フォールバック: コンソールログ
      console.error('Original error:', error);
      return 'ERROR_LOG_FAILED';
    }
  }

  /**
   * リトライ可能なエラーの処理
   */
  async handleRetryableError<T>(
    operation: () => Promise<T>,
    errorType: EmailProcessingErrorType,
    context?: Record<string, any>
  ): Promise<T> {
    let lastError: Error;
    let attempt = 0;

    while (attempt < this.MAX_RETRY_ATTEMPTS) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // エラーログ記録
        await this.logError({
          type: errorType,
          message: error instanceof Error ? error.message : String(error),
          context: { ...context, attempt },
          retryCount: attempt
        });

        if (!this.isRetryableError(errorType) || attempt >= this.MAX_RETRY_ATTEMPTS) {
          break;
        }

        // 指数バックオフで待機
        const delay = this.RETRY_DELAYS[attempt - 1] || 5000;
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * エラー統計の取得
   */
  async getErrorStatistics(
    userId?: string,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    retrySuccessRate: number;
    mostCommonErrors: Array<{ type: string; count: number; message: string }>;
    errorTrends: Array<{ date: string; count: number }>;
  }> {
    try {
      // データベースからエラー統計を取得
      const whereCondition: any = {};
      if (userId) whereCondition.userId = userId;
      if (timeRange) {
        whereCondition.occurredAt = {
          gte: timeRange.start,
          lte: timeRange.end
        };
      }

      const errors = await this.getErrorsFromDatabase(whereCondition);

      // 統計計算
      const totalErrors = errors.length;
      const errorsByType: Record<string, number> = {};
      const errorsBySeverity: Record<string, number> = {};
      let totalRetries = 0;
      let successfulRetries = 0;

      errors.forEach(error => {
        errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
        errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;

        if (error.retryCount && error.retryCount > 0) {
          totalRetries++;
          if (error.resolvedAt) {
            successfulRetries++;
          }
        }
      });

      const retrySuccessRate = totalRetries > 0 ? successfulRetries / totalRetries : 0;

      // 最も一般的なエラーTOP5
      const mostCommonErrors = Object.entries(errorsByType)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([type, count]) => {
          const sample = errors.find(e => e.type === type);
          return {
            type,
            count,
            message: sample?.message || 'No message'
          };
        });

      // エラートレンド（過去7日間）
      const errorTrends = await this.calculateErrorTrends(whereCondition);

      return {
        totalErrors,
        errorsByType,
        errorsBySeverity,
        retrySuccessRate,
        mostCommonErrors,
        errorTrends
      };

    } catch (error) {
      console.error('Failed to get error statistics:', error);
      return {
        totalErrors: 0,
        errorsByType: {},
        errorsBySeverity: {},
        retrySuccessRate: 0,
        mostCommonErrors: [],
        errorTrends: []
      };
    }
  }

  /**
   * エラーパターンの分析
   */
  async analyzeErrorPatterns(
    userId?: string,
    limit: number = 100
  ): Promise<{
    patterns: Array<{
      pattern: string;
      frequency: number;
      severity: string;
      recommendedAction: string;
    }>;
    recommendations: string[];
  }> {
    const errors = await this.getErrorsFromDatabase(
      userId ? { userId } : {},
      limit
    );

    const patterns: Map<string, {
      frequency: number;
      severity: string;
      examples: string[];
    }> = new Map();

    // パターン抽出
    errors.forEach(error => {
      const pattern = this.extractErrorPattern(error);
      if (pattern) {
        const existing = patterns.get(pattern) || {
          frequency: 0,
          severity: error.severity,
          examples: []
        };

        existing.frequency++;
        existing.examples.push(error.message);
        patterns.set(pattern, existing);
      }
    });

    // レコメンデーション生成
    const patternArray = Array.from(patterns.entries()).map(([pattern, data]) => ({
      pattern,
      frequency: data.frequency,
      severity: data.severity,
      recommendedAction: this.generateRecommendedAction(pattern, data)
    }));

    const recommendations = this.generateGlobalRecommendations(patternArray);

    return {
      patterns: patternArray.sort((a, b) => b.frequency - a.frequency),
      recommendations
    };
  }

  /**
   * 自動復旧の試行
   */
  async attemptAutoRecovery(errorId: string): Promise<boolean> {
    try {
      const error = await this.getErrorById(errorId);
      if (!error || !error.isRetryable) {
        return false;
      }

      // 復旧戦略の実行
      const recoverySuccess = await this.executeRecoveryStrategy(error);

      if (recoverySuccess) {
        // エラーを解決済みとしてマーク
        await this.markErrorAsResolved(errorId);
        return true;
      }

      return false;
    } catch (recoveryError) {
      console.error('Auto recovery failed:', recoveryError);
      return false;
    }
  }

  /**
   * エラーの重要度判定
   */
  private determineSeverity(errorType: EmailProcessingErrorType): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const severityMap = {
      // Critical - システム全体に影響
      [EmailProcessingErrorType.DATABASE_CONNECTION_FAILED]: 'CRITICAL',
      [EmailProcessingErrorType.MEMORY_LIMIT_EXCEEDED]: 'CRITICAL',
      [EmailProcessingErrorType.AUTHENTICATION_FAILED]: 'CRITICAL',

      // High - 機能に重大な影響
      [EmailProcessingErrorType.API_RATE_LIMIT]: 'HIGH',
      [EmailProcessingErrorType.GMAIL_API_ERROR]: 'HIGH',
      [EmailProcessingErrorType.DATABASE_SAVE_FAILED]: 'HIGH',

      // Medium - 一部の処理に影響
      [EmailProcessingErrorType.PROCESSING_TIMEOUT]: 'MEDIUM',
      [EmailProcessingErrorType.NETWORK_TIMEOUT]: 'MEDIUM',
      [EmailProcessingErrorType.MULTIPLE_AMOUNTS_FOUND]: 'MEDIUM',

      // Low - 個別ケースのエラー
      [EmailProcessingErrorType.AMOUNT_EXTRACTION_FAILED]: 'LOW',
      [EmailProcessingErrorType.MERCHANT_PARSING_FAILED]: 'LOW',
      [EmailProcessingErrorType.UNKNOWN_EMAIL_FORMAT]: 'LOW',
      [EmailProcessingErrorType.INVALID_AMOUNT_FORMAT]: 'LOW',
      [EmailProcessingErrorType.UNSUPPORTED_CURRENCY]: 'LOW'
    };

    return (severityMap as any)[errorType] || 'MEDIUM';
  }

  /**
   * リトライ可能判定
   */
  private isRetryableError(errorType: EmailProcessingErrorType): boolean {
    const retryableErrors = [
      EmailProcessingErrorType.NETWORK_TIMEOUT,
      EmailProcessingErrorType.API_RATE_LIMIT,
      EmailProcessingErrorType.DATABASE_CONNECTION_FAILED,
      EmailProcessingErrorType.PROCESSING_TIMEOUT,
      EmailProcessingErrorType.GMAIL_API_ERROR
    ];

    return retryableErrors.includes(errorType);
  }

  // プライベートメソッド（実装詳細は省略）
  private async saveErrorToDatabase(error: EmailProcessingError): Promise<EmailProcessingError> {
    // Prismaを使用してエラーを保存
    const saved = await prisma.emailProcessingError.create({
      data: {
        emailDataId: error.emailId || '',
        errorType: error.type,
        errorMessage: error.message,
        emailSubject: error.emailSubject || '',
        emailSender: error.emailSender || ''
      }
    });

    return { ...error, id: saved.id };
  }

  private async getErrorsFromDatabase(whereCondition: any, limit?: number): Promise<EmailProcessingError[]> {
    // 実装詳細省略
    return [];
  }

  private async getErrorById(errorId: string): Promise<EmailProcessingError | null> {
    // 実装詳細省略
    return null;
  }

  private async markErrorAsResolved(errorId: string): Promise<void> {
    // 実装詳細省略
  }

  private async sendCriticalErrorAlert(error: EmailProcessingError): Promise<void> {
    // 実装詳細省略（メール通知、Slack通知等）
  }

  private async updateErrorStatistics(error: EmailProcessingError): Promise<void> {
    // 実装詳細省略
  }

  private async calculateErrorTrends(whereCondition: any): Promise<Array<{ date: string; count: number }>> {
    // 実装詳細省略
    return [];
  }

  private extractErrorPattern(error: EmailProcessingError): string {
    // エラーメッセージからパターンを抽出
    return error.type;
  }

  private generateRecommendedAction(pattern: string, data: any): string {
    const actionMap = {
      [EmailProcessingErrorType.API_RATE_LIMIT]: 'リクエスト頻度を下げる、またはAPIキーを確認してください',
      [EmailProcessingErrorType.AMOUNT_EXTRACTION_FAILED]: 'パターンマッチング辞書を更新してください',
      [EmailProcessingErrorType.AUTHENTICATION_FAILED]: 'Gmail接続を再認証してください',
      [EmailProcessingErrorType.DATABASE_SAVE_FAILED]: 'データベース接続とテーブルスキーマを確認してください'
    };

    return (actionMap as any)[pattern] || '詳細な調査が必要です';
  }

  private generateGlobalRecommendations(patterns: any[]): string[] {
    const recommendations = [];

    if (patterns.some(p => p.pattern.includes('API_RATE_LIMIT'))) {
      recommendations.push('APIレート制限に達しています。処理間隔を調整してください。');
    }

    if (patterns.some(p => p.pattern.includes('EXTRACTION_FAILED'))) {
      recommendations.push('パターンマッチングの精度向上が必要です。新しいメールフォーマットに対応してください。');
    }

    return recommendations;
  }

  private async executeRecoveryStrategy(error: EmailProcessingError): Promise<boolean> {
    // 復旧戦略の実行（実装詳細省略）
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * グローバルエラーマネージャーインスタンス
 */
export const emailErrorManager = new EmailErrorManager();