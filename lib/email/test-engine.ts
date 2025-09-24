/**
 * Email Parsing Test Engine
 * Automated testing and validation for email parsing accuracy
 */

import { EmailParser, ParseResult, calculateAccuracy } from './parser';
import { SUBSCRIPTION_PATTERNS, CREDIT_CARD_PATTERNS } from './patterns';

export interface TestCase {
  id: string;
  name: string;
  description: string;
  email: {
    id: string;
    subject: string;
    sender: string;
    receivedDate: Date;
    body: string;
  };
  expected: {
    success: boolean;
    type?: 'SUBSCRIPTION' | 'TRANSACTION';
    amount?: number;
    currency?: string;
    merchantName?: string;
    serviceName?: string;
    billingCycle?: string;
    confidence?: number;
  };
  tags: string[];
}

export interface TestResult {
  testCase: TestCase;
  parseResult: ParseResult;
  passed: boolean;
  accuracy: number;
  errors: string[];
  executionTime: number;
}

export interface TestSuiteResult {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  overallAccuracy: number;
  averageExecutionTime: number;
  testResults: TestResult[];
  summary: {
    byType: Record<string, { passed: number; total: number; accuracy: number }>;
    byService: Record<string, { passed: number; total: number; accuracy: number }>;
    commonErrors: Array<{ error: string; count: number }>;
  };
  generatedAt: Date;
}

export class EmailParsingTestEngine {
  private parser: EmailParser;
  private testCases: TestCase[] = [];

  constructor() {
    this.parser = new EmailParser(true); // デバッグモード有効
    this.loadDefaultTestCases();
  }

  /**
   * デフォルトテストケースの読み込み
   */
  private loadDefaultTestCases() {
    // サブスクリプションパターンのテストケース
    SUBSCRIPTION_PATTERNS.forEach((pattern, index) => {
      pattern.testCases.forEach((testCase, tcIndex) => {
        this.testCases.push({
          id: `sub_${pattern.serviceName.toLowerCase()}_${tcIndex}`,
          name: `${pattern.serviceName} Subscription Test`,
          description: `Test case for ${pattern.serviceName} subscription detection`,
          email: {
            id: `test_${index}_${tcIndex}`,
            subject: testCase.email.subject,
            sender: testCase.email.sender,
            receivedDate: new Date(),
            body: testCase.email.body
          },
          expected: {
            success: true,
            type: 'SUBSCRIPTION',
            amount: testCase.expected.amount,
            currency: testCase.expected.currency,
            merchantName: testCase.expected.merchantName,
            serviceName: pattern.serviceName,
            billingCycle: pattern.billingCycle,
            confidence: pattern.confidence
          },
          tags: ['subscription', pattern.serviceName.toLowerCase()]
        });
      });
    });

    // クレジットカードパターンのテストケース
    CREDIT_CARD_PATTERNS.forEach((pattern, index) => {
      pattern.testCases.forEach((testCase, tcIndex) => {
        this.testCases.push({
          id: `card_${pattern.issuer.toLowerCase().replace(/\s+/g, '_')}_${tcIndex}`,
          name: `${pattern.issuer} Credit Card Test`,
          description: `Test case for ${pattern.issuer} transaction detection`,
          email: {
            id: `test_card_${index}_${tcIndex}`,
            subject: testCase.email.subject,
            sender: testCase.email.sender,
            receivedDate: new Date(),
            body: testCase.email.body
          },
          expected: {
            success: true,
            type: 'TRANSACTION',
            amount: testCase.expected.amount,
            currency: testCase.expected.currency,
            merchantName: testCase.expected.merchantName
          },
          tags: ['credit_card', pattern.issuer.toLowerCase().replace(/\s+/g, '_')]
        });
      });
    });

    // エラーケースのテストケース
    this.addErrorTestCases();
  }

  /**
   * エラーケースの追加
   */
  private addErrorTestCases() {
    const errorCases: TestCase[] = [
      {
        id: 'error_no_amount',
        name: 'No Amount Test',
        description: 'Email with no amount should fail parsing',
        email: {
          id: 'test_error_1',
          subject: 'Netflix - Account Update',
          sender: 'noreply@account.netflix.com',
          receivedDate: new Date(),
          body: 'Your Netflix account settings have been updated. No payment information.'
        },
        expected: {
          success: false
        },
        tags: ['error', 'no_amount']
      },
      {
        id: 'error_invalid_amount',
        name: 'Invalid Amount Format Test',
        description: 'Email with invalid amount format',
        email: {
          id: 'test_error_2',
          subject: 'Payment Notification',
          sender: 'test@example.com',
          receivedDate: new Date(),
          body: 'Payment amount: ¥abc,123 has been processed.'
        },
        expected: {
          success: false
        },
        tags: ['error', 'invalid_amount']
      },
      {
        id: 'error_multiple_amounts',
        name: 'Multiple Amounts Test',
        description: 'Email with multiple conflicting amounts',
        email: {
          id: 'test_error_3',
          subject: 'Payment Summary',
          sender: 'billing@example.com',
          receivedDate: new Date(),
          body: 'Subtotal: ¥1,000, Tax: ¥100, Total: ¥1,500, Refund: ¥200'
        },
        expected: {
          success: true, // Should succeed but with lower confidence
          confidence: 0.5
        },
        tags: ['edge_case', 'multiple_amounts']
      }
    ];

    this.testCases.push(...errorCases);
  }

  /**
   * 単一テストケースの実行
   */
  async runSingleTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const parseResult = await this.parser.parseEmail(testCase.email);
      const executionTime = Date.now() - startTime;

      // 結果の検証
      const passed = this.validateResult(testCase, parseResult);
      const accuracy = calculateAccuracy(parseResult, testCase.expected);

      const errors: string[] = [];
      if (!passed) {
        errors.push(...this.generateErrorMessages(testCase, parseResult));
      }

      return {
        testCase,
        parseResult,
        passed,
        accuracy,
        errors,
        executionTime
      };

    } catch (error) {
      return {
        testCase,
        parseResult: {
          success: false,
          confidence: 0,
          type: 'UNKNOWN',
          errors: [`Test execution error: ${error.message}`]
        },
        passed: false,
        accuracy: 0,
        errors: [`Test execution failed: ${error.message}`],
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * テストスイート全体の実行
   */
  async runFullTestSuite(
    tags?: string[],
    maxConcurrency: number = 3
  ): Promise<TestSuiteResult> {
    const filteredTests = tags
      ? this.testCases.filter(tc => tags.some(tag => tc.tags.includes(tag)))
      : this.testCases;

    console.log(`Running ${filteredTests.length} test cases...`);

    const results: TestResult[] = [];

    // 並列実行制限付きでテスト実行
    for (let i = 0; i < filteredTests.length; i += maxConcurrency) {
      const batch = filteredTests.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(testCase => this.runSingleTest(testCase));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 進捗表示
      const progress = Math.round(((i + batch.length) / filteredTests.length) * 100);
      console.log(`Test progress: ${progress}% (${i + batch.length}/${filteredTests.length})`);
    }

    return this.generateTestSuiteResult('Full Test Suite', results);
  }

  /**
   * パフォーマンステストの実行
   */
  async runPerformanceTest(
    iterations: number = 100,
    concurrency: number = 5
  ): Promise<{
    averageExecutionTime: number;
    minExecutionTime: number;
    maxExecutionTime: number;
    throughput: number; // emails per second
    memoryUsage?: {
      before: NodeJS.MemoryUsage;
      after: NodeJS.MemoryUsage;
      peak: NodeJS.MemoryUsage;
    };
  }> {
    const testEmail = this.testCases.find(tc => tc.tags.includes('subscription'));
    if (!testEmail) {
      throw new Error('No test email found for performance testing');
    }

    const memoryBefore = process.memoryUsage();
    let peakMemory = memoryBefore;

    const executionTimes: number[] = [];
    const startTime = Date.now();

    // 並列実行でパフォーマンステスト
    const batches: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      const batchPromise = (async () => {
        const iterationsPerWorker = Math.ceil(iterations / concurrency);

        for (let j = 0; j < iterationsPerWorker && (i * iterationsPerWorker + j) < iterations; j++) {
          const testStart = Date.now();
          await this.parser.parseEmail(testEmail.email);
          const testEnd = Date.now();

          executionTimes.push(testEnd - testStart);

          // メモリ使用量チェック
          const currentMemory = process.memoryUsage();
          if (currentMemory.heapUsed > peakMemory.heapUsed) {
            peakMemory = currentMemory;
          }
        }
      })();

      batches.push(batchPromise);
    }

    await Promise.all(batches);

    const totalTime = Date.now() - startTime;
    const memoryAfter = process.memoryUsage();

    return {
      averageExecutionTime: executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length,
      minExecutionTime: Math.min(...executionTimes),
      maxExecutionTime: Math.max(...executionTimes),
      throughput: (iterations * 1000) / totalTime, // emails per second
      memoryUsage: {
        before: memoryBefore,
        after: memoryAfter,
        peak: peakMemory
      }
    };
  }

  /**
   * 精度向上のための分析
   */
  async analyzeAccuracy(tags?: string[]): Promise<{
    overallAccuracy: number;
    accuracyByService: Record<string, number>;
    accuracyByType: Record<string, number>;
    lowAccuracyTests: TestResult[];
    recommendations: string[];
  }> {
    const results = await this.runFullTestSuite(tags, 1);

    const accuracyByService: Record<string, number> = {};
    const accuracyByType: Record<string, number> = {};

    results.testResults.forEach(result => {
      // サービス別精度
      const serviceName = result.testCase.expected.serviceName;
      if (serviceName) {
        if (!accuracyByService[serviceName]) {
          accuracyByService[serviceName] = 0;
        }
        accuracyByService[serviceName] = Math.max(accuracyByService[serviceName], result.accuracy);
      }

      // タイプ別精度
      const type = result.testCase.expected.type;
      if (type) {
        if (!accuracyByType[type]) {
          accuracyByType[type] = 0;
        }
        accuracyByType[type] = Math.max(accuracyByType[type], result.accuracy);
      }
    });

    // 低精度テスト（70%未満）の抽出
    const lowAccuracyTests = results.testResults.filter(r => r.accuracy < 0.7);

    // 改善推奨事項の生成
    const recommendations = this.generateRecommendations(lowAccuracyTests);

    return {
      overallAccuracy: results.overallAccuracy,
      accuracyByService,
      accuracyByType,
      lowAccuracyTests,
      recommendations
    };
  }

  /**
   * カスタムテストケースの追加
   */
  addCustomTestCase(testCase: TestCase) {
    this.testCases.push(testCase);
  }

  /**
   * テストケースの取得
   */
  getTestCases(tags?: string[]): TestCase[] {
    return tags
      ? this.testCases.filter(tc => tags.some(tag => tc.tags.includes(tag)))
      : [...this.testCases];
  }

  // プライベートメソッド
  private validateResult(testCase: TestCase, parseResult: ParseResult): boolean {
    const expected = testCase.expected;

    // 基本的な成功/失敗チェック
    if (expected.success !== parseResult.success) {
      return false;
    }

    if (!parseResult.success) {
      return true; // 失敗期待の場合はOK
    }

    // 詳細な検証
    if (expected.type && parseResult.type !== expected.type) {
      return false;
    }

    if (expected.amount && parseResult.data?.amount !== expected.amount) {
      // 5%以内の誤差は許容
      const tolerance = Math.abs(parseResult.data?.amount - expected.amount) / expected.amount;
      if (tolerance > 0.05) {
        return false;
      }
    }

    if (expected.currency && parseResult.data?.currency !== expected.currency) {
      return false;
    }

    if (expected.confidence && parseResult.confidence < expected.confidence) {
      return false;
    }

    return true;
  }

  private generateErrorMessages(testCase: TestCase, parseResult: ParseResult): string[] {
    const errors: string[] = [];
    const expected = testCase.expected;

    if (expected.success !== parseResult.success) {
      errors.push(`Expected success: ${expected.success}, got: ${parseResult.success}`);
    }

    if (expected.type && parseResult.type !== expected.type) {
      errors.push(`Expected type: ${expected.type}, got: ${parseResult.type}`);
    }

    if (expected.amount && parseResult.data?.amount !== expected.amount) {
      errors.push(`Expected amount: ${expected.amount}, got: ${parseResult.data?.amount}`);
    }

    if (expected.currency && parseResult.data?.currency !== expected.currency) {
      errors.push(`Expected currency: ${expected.currency}, got: ${parseResult.data?.currency}`);
    }

    return errors;
  }

  private generateTestSuiteResult(suiteName: string, results: TestResult[]): TestSuiteResult {
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;
    const overallAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
    const averageExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;

    // タイプ別統計
    const byType: Record<string, { passed: number; total: number; accuracy: number }> = {};
    const byService: Record<string, { passed: number; total: number; accuracy: number }> = {};

    results.forEach(result => {
      const type = result.testCase.expected.type;
      const service = result.testCase.expected.serviceName;

      if (type) {
        if (!byType[type]) byType[type] = { passed: 0, total: 0, accuracy: 0 };
        byType[type].total++;
        byType[type].accuracy += result.accuracy;
        if (result.passed) byType[type].passed++;
      }

      if (service) {
        if (!byService[service]) byService[service] = { passed: 0, total: 0, accuracy: 0 };
        byService[service].total++;
        byService[service].accuracy += result.accuracy;
        if (result.passed) byService[service].passed++;
      }
    });

    // 平均精度の計算
    Object.keys(byType).forEach(key => {
      byType[key].accuracy /= byType[key].total;
    });
    Object.keys(byService).forEach(key => {
      byService[key].accuracy /= byService[key].total;
    });

    // 共通エラーの集計
    const errorCount: Record<string, number> = {};
    results.forEach(result => {
      result.errors.forEach(error => {
        errorCount[error] = (errorCount[error] || 0) + 1;
      });
    });

    const commonErrors = Object.entries(errorCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));

    return {
      suiteName,
      totalTests: results.length,
      passedTests,
      failedTests,
      overallAccuracy,
      averageExecutionTime,
      testResults: results,
      summary: {
        byType,
        byService,
        commonErrors
      },
      generatedAt: new Date()
    };
  }

  private generateRecommendations(lowAccuracyTests: TestResult[]): string[] {
    const recommendations: string[] = [];

    // パターン分析
    const failurePatterns: Record<string, number> = {};

    lowAccuracyTests.forEach(test => {
      test.errors.forEach(error => {
        const pattern = error.split(':')[0]; // エラーの種類を抽出
        failurePatterns[pattern] = (failurePatterns[pattern] || 0) + 1;
      });
    });

    // 推奨事項の生成
    if (failurePatterns['Expected amount']) {
      recommendations.push('金額抽出パターンの見直しが必要です。新しい金額表記形式に対応してください。');
    }

    if (failurePatterns['Expected type']) {
      recommendations.push('サービス分類の精度向上が必要です。送信者パターンを見直してください。');
    }

    if (failurePatterns['Expected currency']) {
      recommendations.push('通貨検出の精度向上が必要です。通貨表記パターンを追加してください。');
    }

    if (recommendations.length === 0) {
      recommendations.push('テスト結果は良好です。継続的な監視を推奨します。');
    }

    return recommendations;
  }
}

// グローバルインスタンス
export const testEngine = new EmailParsingTestEngine();