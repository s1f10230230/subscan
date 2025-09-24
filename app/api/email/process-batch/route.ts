import { NextRequest, NextResponse } from 'next/server';
import { EmailBackgroundProcessor, ProcessingOptions } from '@/lib/email/background-processor';

interface ProcessBatchRequest {
  jobId: string;
  startIndex: number;
  options: ProcessingOptions;
}

/**
 * バッチ処理継続API
 * Vercelの実行時間制限内でバッチ処理を継続するためのエンドポイント
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ProcessBatchRequest;
    const { jobId, startIndex, options } = body;

    if (!jobId || typeof startIndex !== 'number') {
      return NextResponse.json({
        error: 'Invalid request parameters'
      }, { status: 400 });
    }

    const processor = new EmailBackgroundProcessor();

    // バッチ処理を非同期で継続
    // Note: Vercel環境では await しない（レスポンス返却後に処理継続）
    processor['processBatch'](jobId, startIndex, options).catch(error => {
      console.error('Batch processing continuation error:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Batch processing scheduled',
      jobId,
      startIndex
    });

  } catch (error) {
    console.error('Process batch API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * 処理状況取得API
 */
export async function GET(req: NextRequest) {
  try {
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

    const stats = calculateJobStats(job);
    const estimatedTime = calculateEstimatedTime(job);

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        processedEmails: job.processedEmails,
        totalEmails: job.totalEmails,
        batchIndex: job.batchIndex,
        stats,
        estimatedTimeRemaining: estimatedTime,
        errors: job.errors,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt
      }
    });

  } catch (error) {
    console.error('Get batch status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

function calculateJobStats(job: any) {
  const successfulResults = job.results?.filter((r: any) => r.success) || [];
  const subscriptions = successfulResults.filter((r: any) => r.type === 'SUBSCRIPTION');
  const transactions = successfulResults.filter((r: any) => r.type === 'TRANSACTION');

  return {
    totalProcessed: job.results?.length || 0,
    successful: successfulResults.length,
    failed: (job.results?.length || 0) - successfulResults.length,
    subscriptionsFound: subscriptions.length,
    transactionsFound: transactions.length,
    averageConfidence: successfulResults.length > 0 ?
      successfulResults.reduce((sum: number, r: any) => sum + (r.confidence || 0), 0) / successfulResults.length :
      0
  };
}

function calculateEstimatedTime(job: any): number {
  if (job.progress === 0 || job.status !== 'RUNNING') {
    return 0;
  }

  const elapsed = Date.now() - new Date(job.createdAt).getTime();
  const remainingProgress = 100 - job.progress;

  return Math.round((elapsed / job.progress) * remainingProgress / 1000); // 秒
}