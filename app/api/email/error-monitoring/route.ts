import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { emailErrorManager, EmailProcessingErrorType } from '@/lib/email/error-manager';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * エラー統計取得API
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('timeRange');
    const includeResolved = searchParams.get('includeResolved') === 'true';

    // 時間範囲の設定
    let dateRange: { start: Date; end: Date } | undefined;
    if (timeRange) {
      const end = new Date();
      const start = new Date();

      switch (timeRange) {
        case '1h':
          start.setHours(start.getHours() - 1);
          break;
        case '24h':
          start.setDate(start.getDate() - 1);
          break;
        case '7d':
          start.setDate(start.getDate() - 7);
          break;
        case '30d':
          start.setDate(start.getDate() - 30);
          break;
        default:
          start.setDate(start.getDate() - 1);
      }

      dateRange = { start, end };
    }

    // エラー統計取得
    const statistics = await emailErrorManager.getErrorStatistics(user.id, dateRange);

    // エラーパターン分析
    const patterns = await emailErrorManager.analyzeErrorPatterns(user.id);

    // 最近のエラー一覧
    const recentErrors = await getRecentErrors(user.id, 20, includeResolved);

    return NextResponse.json({
      success: true,
      data: {
        statistics,
        patterns: patterns.patterns,
        recommendations: patterns.recommendations,
        recentErrors,
        timeRange: timeRange || '24h',
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error monitoring API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * エラー報告API
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const {
      errorType,
      message,
      emailId,
      emailSubject,
      emailSender,
      context,
      severity,
      processingJobId
    } = body;

    // エラーの記録
    const errorId = await emailErrorManager.logError({
      type: errorType as EmailProcessingErrorType,
      message,
      emailId,
      emailSubject,
      emailSender,
      context,
      severity,
      userId: user.id,
      processingJobId
    });

    return NextResponse.json({
      success: true,
      data: {
        errorId,
        message: 'Error logged successfully'
      }
    });

  } catch (error) {
    console.error('Error logging API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * エラー復旧試行API
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const errorId = searchParams.get('errorId');
    const action = searchParams.get('action');

    if (!errorId) {
      return NextResponse.json({
        error: 'Error ID is required'
      }, { status: 400 });
    }

    let result = false;
    let message = '';

    switch (action) {
      case 'retry':
        result = await emailErrorManager.attemptAutoRecovery(errorId);
        message = result ? 'Recovery successful' : 'Recovery failed';
        break;

      case 'resolve':
        // 手動解決
        await markErrorAsResolved(errorId);
        result = true;
        message = 'Error marked as resolved';
        break;

      case 'ignore':
        // エラーを無視リストに追加
        await addErrorToIgnoreList(errorId, user.id);
        result = true;
        message = 'Error added to ignore list';
        break;

      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 });
    }

    return NextResponse.json({
      success: result,
      data: {
        errorId,
        action,
        message
      }
    });

  } catch (error) {
    console.error('Error recovery API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * エラー削除API
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const errorId = searchParams.get('errorId');
    const timeRange = searchParams.get('timeRange');

    if (errorId) {
      // 特定エラーの削除
      await deleteError(errorId);
      return NextResponse.json({
        success: true,
        message: 'Error deleted successfully'
      });
    } else if (timeRange) {
      // 期間指定での一括削除
      const deletedCount = await deleteErrorsByTimeRange(timeRange);
      return NextResponse.json({
        success: true,
        message: `${deletedCount} errors deleted`
      });
    } else {
      return NextResponse.json({
        error: 'Error ID or time range is required'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Error deletion API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * ヘルパー関数群
 */

async function getRecentErrors(userId: string, limit: number, includeResolved: boolean) {
  try {
    const errors = await prisma.emailProcessingError.findMany({
      where: includeResolved ? {} : {
        // 未解決のもののみ
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    return errors.map(error => ({
      id: error.id,
      type: error.errorType,
      message: error.errorMessage,
      emailSubject: error.emailSubject,
      emailSender: error.emailSender,
      createdAt: error.createdAt,
      severity: determineSeverityFromType(error.errorType),
      isResolved: false // 実装に応じて調整
    }));
  } catch (error) {
    console.error('Failed to get recent errors:', error);
    return [];
  }
}

async function markErrorAsResolved(errorId: string) {
  // 実装: エラーを解決済みとしてマーク
  // 実際の実装では追加のテーブルまたはフラグを使用
  console.log(`Marking error ${errorId} as resolved`);
}

async function addErrorToIgnoreList(errorId: string, userId: string) {
  // 実装: エラーを無視リストに追加
  console.log(`Adding error ${errorId} to ignore list for user ${userId}`);
}

async function deleteError(errorId: string) {
  try {
    await prisma.emailProcessingError.delete({
      where: { id: errorId }
    });
  } catch (error) {
    console.error('Failed to delete error:', error);
    throw error;
  }
}

async function deleteErrorsByTimeRange(timeRange: string): Promise<number> {
  const cutoffDate = new Date();

  switch (timeRange) {
    case '1d':
      cutoffDate.setDate(cutoffDate.getDate() - 1);
      break;
    case '7d':
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      break;
    case '30d':
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      break;
    default:
      throw new Error('Invalid time range');
  }

  try {
    const result = await prisma.emailProcessingError.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    return result.count;
  } catch (error) {
    console.error('Failed to delete errors by time range:', error);
    throw error;
  }
}

function determineSeverityFromType(errorType: string): string {
  const severityMap: Record<string, string> = {
    'DATABASE_CONNECTION_FAILED': 'CRITICAL',
    'AUTHENTICATION_FAILED': 'CRITICAL',
    'API_RATE_LIMIT': 'HIGH',
    'GMAIL_API_ERROR': 'HIGH',
    'PROCESSING_TIMEOUT': 'MEDIUM',
    'AMOUNT_EXTRACTION_FAILED': 'LOW'
  };

  return severityMap[errorType] || 'MEDIUM';
}