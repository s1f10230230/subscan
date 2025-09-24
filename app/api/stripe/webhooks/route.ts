import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const body = await request.text()
  const sig = headers().get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err) {
    console.error(`Webhook signature verification failed.`, err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    // イベントのログを保存（デバッグ用）
    await prisma.stripeWebhookLog.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        data: JSON.stringify(event.data),
        processed: false,
      },
    })

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionCompleted(session)
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentFailed(invoice)
        break
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaymentSucceeded(invoice)
        break
      }
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // ログを処理済みとしてマーク
    await prisma.stripeWebhookLog.update({
      where: { stripeEventId: event.id },
      data: { processed: true },
    })

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler failed:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  if (!userId) {
    console.error('No userId in checkout session metadata')
    return
  }

  const planType = session.metadata?.planType as 'STANDARD' | 'PRO'
  if (!planType) {
    console.error('No planType in checkout session metadata')
    return
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: planType,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      subscriptionStatus: 'active',
    },
  })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const user = await prisma.user.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  })

  if (!user) {
    console.error(`User not found for subscription: ${subscription.id}`)
    return
  }

  let planType = 'FREE'
  if (subscription.status === 'active') {
    // サブスクリプションの金額から判定
    const price = subscription.items.data[0]?.price
    if (price?.unit_amount === 980) {
      planType = 'STANDARD'
    } else if (price?.unit_amount === 1980) {
      planType = 'PRO'
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: planType,
      subscriptionStatus: subscription.status,
      subscriptionEndsAt:
        subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
    },
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const user = await prisma.user.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  })

  if (!user) {
    console.error(`User not found for subscription: ${subscription.id}`)
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      subscriptionStatus: 'canceled',
      subscriptionEndsAt: null,
    },
  })
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return

  const user = await prisma.user.findUnique({
    where: { stripeSubscriptionId: invoice.subscription as string },
  })

  if (!user) return

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: 'past_due',
    },
  })
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return

  const user = await prisma.user.findUnique({
    where: { stripeSubscriptionId: invoice.subscription as string },
  })

  if (!user) return

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: 'active',
    },
  })
}