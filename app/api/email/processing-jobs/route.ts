import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { EmailBackgroundProcessor, ProcessingOptions } from '@/lib/email/background-processor';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface StartJobRequest {
  maxEmails?: number;
  confidenceThreshold?: number;
  autoSave?: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * バックグラウンド処理ジョブ開始API
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

    const body = await req.json() as StartJobRequest;
    const {
      maxEmails = 200,
      confidenceThreshold = 0.7,
      autoSave = false,
      dateRange
    } = body;

    const options: ProcessingOptions = {
      maxEmails,
      confidenceThreshold,
      autoSave,
      dateRange: dateRange ? {
        start: new Date(dateRange.start),
        end: new Date(dateRange.end)
      } : undefined
    };

    const processor = new EmailBackgroundProcessor();

    try {
      const job = await processor.startProcessingJob(user.id, options);

      return NextResponse.json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          totalEmails: job.totalEmails,
          options: {
            maxEmails,
            confidenceThreshold,
            autoSave,
            dateRange
          },
          createdAt: job.createdAt
        }
      });

    } catch (processingError) {
      if ((processingError instanceof Error ? processingError.message : String(processingError)).includes('処理中のジョブが既に存在')) {
        return NextResponse.json({
          error: 'Active job already exists',
          code: 'ACTIVE_JOB_EXISTS'
        }, { status: 409 });
      }

      throw processingError;
    }

  } catch (error) {
    console.error('Start processing job error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * ユーザーのジョブ一覧取得API
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
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    const processor = new EmailBackgroundProcessor();

    // アクティブジョブの取得
    const activeJob = await processor.getActiveJob(user.id);

    // 履歴ジョブの取得（実装では実際のストレージから取得）
    const historyJobs = await getJobHistory(user.id, status, limit);

    return NextResponse.json({
      success: true,
      data: {
        activeJob,
        historyJobs,
        totalJobs: historyJobs.length + (activeJob ? 1 : 0)
      }
    });

  } catch (error) {
    console.error('Get processing jobs error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * 特定ジョブの削除/キャンセルAPI
 */
export async function DELETE(req: NextRequest) {
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
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({
        error: 'Job ID is required'
      }, { status: 400 });
    }

    const processor = new EmailBackgroundProcessor();
    const job = await processor.getJobStatus(jobId);

    if (!job) {
      return NextResponse.json({
        error: 'Job not found'
      }, { status: 404 });
    }

    if (job.userId !== user.id) {
      return NextResponse.json({
        error: 'Unauthorized to cancel this job'
      }, { status: 403 });
    }

    if (job.status === 'RUNNING') {
      // 実行中ジョブのキャンセル処理
      await cancelRunningJob(jobId);
    } else {
      // 完了済みジョブの削除
      await deleteJobHistory(jobId);
    }

    return NextResponse.json({
      success: true,
      message: job.status === 'RUNNING' ? 'Job cancelled' : 'Job deleted'
    });

  } catch (error) {
    console.error('Delete processing job error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * ジョブ履歴の取得（実装例）
 */
async function getJobHistory(userId: string, status?: string | null, limit: number = 10) {
  // 実際の実装では Redis や データベースから取得
  // ここでは簡略化のため空配列を返す
  return [];
}

/**
 * 実行中ジョブのキャンセル
 */
async function cancelRunningJob(jobId: string) {
  // 実装では以下を行う:
  // 1. ジョブステータスを CANCELLED に更新
  // 2. 次のバッチ処理をスキップするフラグを設定
  // 3. 部分的な結果があれば保存

  console.log(`Cancelling job: ${jobId}`);

  // 実装詳細は省略
}

/**
 * ジョブ履歴の削除
 */
async function deleteJobHistory(jobId: string) {
  // 実装では以下を行う:
  // 1. ジョブデータの削除
  // 2. 関連する一時ファイルの削除
  // 3. キャッシュのクリア

  console.log(`Deleting job history: ${jobId}`);

  // 実装詳細は省略
}

/**
 * ジョブ統計の取得API
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

    // ユーザーの処理統計を計算
    const stats = await calculateUserProcessingStats(user.id);

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get processing stats error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * ユーザーの処理統計計算
 */
async function calculateUserProcessingStats(userId: string) {
  // 実装では実際の統計を計算
  return {
    totalJobsRun: 0,
    totalEmailsProcessed: 0,
    totalSubscriptionsFound: 0,
    totalTransactionsFound: 0,
    averageJobDuration: 0, // 秒
    lastProcessedAt: null,
    successRate: 0.0 // パーセンテージ
  };
}