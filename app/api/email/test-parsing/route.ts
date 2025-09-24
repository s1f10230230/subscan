import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { testEngine } from '@/lib/email/test-engine';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface TestRequest {
  testType: 'full' | 'performance' | 'accuracy' | 'custom';
  tags?: string[];
  customTest?: {
    email: {
      subject: string;
      sender: string;
      body: string;
    };
    expected: {
      success: boolean;
      type?: 'SUBSCRIPTION' | 'TRANSACTION';
      amount?: number;
      currency?: string;
      merchantName?: string;
    };
  };
  performanceConfig?: {
    iterations: number;
    concurrency: number;
  };
}

/**
 * パーサーテスト実行API
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as TestRequest;
    const { testType, tags, customTest, performanceConfig } = body;

    let result: any;

    switch (testType) {
      case 'full':
        console.log('Running full test suite...');
        result = await testEngine.runFullTestSuite(tags);
        break;

      case 'performance':
        console.log('Running performance test...');
        const config = performanceConfig || { iterations: 100, concurrency: 5 };
        result = await testEngine.runPerformanceTest(config.iterations, config.concurrency);
        break;

      case 'accuracy':
        console.log('Running accuracy analysis...');
        result = await testEngine.analyzeAccuracy(tags);
        break;

      case 'custom':
        if (!customTest) {
          return NextResponse.json({
            error: 'Custom test data is required for custom test type'
          }, { status: 400 });
        }

        console.log('Running custom test...');
        const testCase = {
          id: 'custom_test',
          name: 'Custom Test',
          description: 'User-defined custom test case',
          email: {
            id: 'custom_email',
            subject: customTest.email.subject,
            sender: customTest.email.sender,
            receivedDate: new Date(),
            body: customTest.email.body
          },
          expected: customTest.expected,
          tags: ['custom']
        };

        // カスタムテストケースを一時的に追加
        testEngine.addCustomTestCase(testCase);
        result = await testEngine.runSingleTest(testCase);
        break;

      default:
        return NextResponse.json({
          error: 'Invalid test type'
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      testType,
      data: result,
      executedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Test execution error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      testType: 'unknown'
    }, { status: 500 });
  }
}

/**
 * テストケース一覧取得API
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tags = searchParams.get('tags')?.split(',');
    const includeDetails = searchParams.get('includeDetails') === 'true';

    const testCases = testEngine.getTestCases(tags);

    // 詳細情報を含めるかどうか
    const responseData = includeDetails
      ? testCases
      : testCases.map(tc => ({
          id: tc.id,
          name: tc.name,
          description: tc.description,
          tags: tc.tags
        }));

    // 統計情報の計算
    const statistics = {
      totalTestCases: testCases.length,
      byTags: testCases.reduce((acc: Record<string, number>, tc) => {
        tc.tags.forEach(tag => {
          acc[tag] = (acc[tag] || 0) + 1;
        });
        return acc;
      }, {}),
      byType: testCases.reduce((acc: Record<string, number>, tc) => {
        const type = tc.expected.type || 'UNKNOWN';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    };

    return NextResponse.json({
      success: true,
      data: {
        testCases: responseData,
        statistics,
        availableTags: Array.from(new Set(testCases.flatMap(tc => tc.tags))).sort()
      }
    });

  } catch (error) {
    console.error('Get test cases error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * テスト履歴管理API
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, testRunId } = body;

    switch (action) {
      case 'save_results':
        // テスト結果を保存（実装例）
        const savedId = await saveTestResults(body.results);
        return NextResponse.json({
          success: true,
          message: 'Test results saved',
          resultId: savedId
        });

      case 'get_history':
        // テスト履歴の取得
        const history = await getTestHistory(session.user.email);
        return NextResponse.json({
          success: true,
          data: { history }
        });

      case 'compare_results':
        // 2つのテスト結果の比較
        const comparison = await compareTestResults(body.result1Id, body.result2Id);
        return NextResponse.json({
          success: true,
          data: { comparison }
        });

      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Test management error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * 継続的インテグレーション用テストAPI
 */
export async function PATCH(req: NextRequest) {
  try {
    // CI/CD環境での自動テスト実行
    const criticalTests = await testEngine.runFullTestSuite(['critical']);

    // 重要なテストが失敗していないかチェック
    const criticalFailures = criticalTests.testResults.filter(
      result => !result.passed && result.testCase.tags.includes('critical')
    );

    if (criticalFailures.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Critical tests failed',
        data: {
          failedTests: criticalFailures.map(f => ({
            testId: f.testCase.id,
            errors: f.errors,
            accuracy: f.accuracy
          })),
          overallAccuracy: criticalTests.overallAccuracy
        }
      }, { status: 422 });
    }

    // 全体精度チェック（90%以上必要）
    if (criticalTests.overallAccuracy < 0.9) {
      return NextResponse.json({
        success: false,
        error: 'Overall accuracy below threshold',
        data: {
          accuracy: criticalTests.overallAccuracy,
          threshold: 0.9,
          recommendations: await generateCIRecommendations(criticalTests)
        }
      }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      message: 'All critical tests passed',
      data: {
        testResults: criticalTests,
        ciStatus: 'PASSED'
      }
    });

  } catch (error) {
    console.error('CI test execution error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      ciStatus: 'ERROR'
    }, { status: 500 });
  }
}

// ヘルパー関数群

async function saveTestResults(results: any): Promise<string> {
  // 実装: テスト結果をデータベースに保存
  const testRunId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 実際の実装では prisma を使用してデータベースに保存
  console.log(`Saving test results with ID: ${testRunId}`);

  return testRunId;
}

async function getTestHistory(userEmail: string): Promise<any[]> {
  // 実装: ユーザーのテスト履歴を取得
  // 実際の実装ではデータベースから取得
  return [];
}

async function compareTestResults(result1Id: string, result2Id: string): Promise<any> {
  // 実装: 2つのテスト結果を比較
  return {
    result1Id,
    result2Id,
    accuracyImprovement: 0,
    performanceImprovement: 0,
    newFailures: [],
    fixedFailures: []
  };
}

async function generateCIRecommendations(testResults: any): Promise<string[]> {
  const recommendations: string[] = [];

  if (testResults.overallAccuracy < 0.9) {
    recommendations.push('Overall accuracy is below 90%. Review failed test cases.');
  }

  const failedSubscriptionTests = testResults.testResults.filter(
    (r: any) => !r.passed && r.testCase.tags.includes('subscription')
  );

  if (failedSubscriptionTests.length > 0) {
    recommendations.push('Subscription pattern matching needs improvement.');
  }

  const failedCreditCardTests = testResults.testResults.filter(
    (r: any) => !r.passed && r.testCase.tags.includes('credit_card')
  );

  if (failedCreditCardTests.length > 0) {
    recommendations.push('Credit card transaction patterns need review.');
  }

  return recommendations;
}