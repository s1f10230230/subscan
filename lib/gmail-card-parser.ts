// gmail-card-parser.ts
//
// This module provides functions to fetch and parse credit-card usage
// notification emails from Gmail.  It supports JCB and Rakuten cards
// and includes heuristics to detect subscription-like transactions.
//
// The parser extracts the amount, merchant and date from each email
// and normalizes merchant names.  It also flags likely subscription
// transactions.  In particular, recurring overseas charges from
// JCB (表示に「海外利用分」が含まれるもの) are treated as potential
// subscriptions even though the amount varies from month to month due
// to exchange-rate fluctuations.  The subscription refinement logic
// considers repeated transactions across different months and uses
// a relaxed threshold for overseas charges.

import { google, gmail_v1 } from "googleapis";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type Provider = "JCB" | "Rakuten" | "Unknown";
export type Category = "交通費" | "食費" | "サブすく" | "その他";

export interface Transaction {
  id: string;               // Gmail message id
  emailTs?: string;         // RFC3339 timestamp from Date header
  sender?: string;          // From header
  provider: Provider;       // Detected card provider
  cardName?: string;        // Optional card name if present in email
  amount: number | null;    // Amount in JPY (null if unknown)
  merchantRaw?: string;     // Raw merchant string extracted from email
  merchant: string;         // Cleaned merchant name
  merchantNorm: string;     // Normalized (lowercase) merchant name
  occurredAt?: string;      // Local time (YYYY-MM-DD HH:mm) when transaction occurred
  labels?: string[];        // Gmail labels
  subject?: string;         // Email subject
  isSubscriptionCandidate: boolean; // True if preliminary subscription heuristic
  category: Category;       // Categorized spending type
}

export interface MonthlySummaryRow {
  month: string;                        // YYYY-MM
  provider: Provider;
  total: number;                        // Sum of amounts for the month
  byCategory: Record<Category, number>; // Sum by category
  txCount: number;                      // Transaction count
}

export interface ParseOptions {
  newerThanDays?: number; // Time window for Gmail search (days)
  maxMessages?: number;   // Maximum messages per provider
}

// -----------------------------------------------------------------------------
// OAuth helper
// -----------------------------------------------------------------------------

/**
 * Create a Gmail client using a bare OAuth access token.  This helper is
 * provided as an example; in a real application you would manage tokens
 * through OAuth flows.
 */
export function getGmailClientFromAccessToken(accessToken: string) {
  const oAuth2Client = new google.auth.OAuth2();
  oAuth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth: oAuth2Client });
}

// -----------------------------------------------------------------------------
// Gmail fetchers
// -----------------------------------------------------------------------------

/**
 * Fetch a list of message IDs matching the given Gmail search query.
 * Pagination is handled to respect the max limit.
 */
async function listMessageIds(
  gmail: gmail_v1.Gmail,
  q: string,
  max = 200
): Promise<string[]> {
  let pageToken: string | undefined = undefined;
  const ids: string[] = [];
  do {
    const res = await gmail.users.messages.list({
      userId: "me",
      q,
      pageToken,
      maxResults: Math.min(100, max),
    });
    const messages = res.data.messages || [];
    ids.push(...messages.map((m) => m.id!).filter(Boolean));
    pageToken = res.data.nextPageToken || undefined;
    if (ids.length >= max) break;
  } while (pageToken);
  return ids.slice(0, max);
}

/**
 * Decode base64url-encoded strings into UTF-8.
 */
function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const buff = Buffer.from(normalized, "base64");
  return buff.toString("utf8");
}

/**
 * Strip HTML tags and convert <br> to newlines.  This helps us extract
 * plaintext from HTML bodies.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>(?=\s|$)/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n");
}

/**
 * Retrieve the body of a Gmail message.  We prefer text/plain parts if
 * available; otherwise we fall back to text/html and finally to the snippet.
 * Returns the extracted text, header map and label list.
 */
async function getMessageBody(
  gmail: gmail_v1.Gmail,
  id: string
): Promise<{ text: string; headers: Record<string, string>; labels: string[] }> {
  const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  const payload = res.data.payload;
  const headersArr = payload?.headers || [];
  const headers: Record<string, string> = {};
  for (const h of headersArr) {
    if (h.name && h.value) headers[h.name] = h.value;
  }
  const labels = res.data.labelIds || [];

  function walk(p?: gmail_v1.Schema$MessagePart): string | null {
    if (!p) return null;
    const mime = p.mimeType || "";
    if (p.body?.data && (mime.startsWith("text/plain") || mime.startsWith("text/html"))) {
      const decoded = decodeBase64Url(p.body.data);
      return mime.startsWith("text/html") ? stripHtml(decoded) : decoded;
    }
    if (p.parts) {
      for (const part of p.parts) {
        const got = walk(part);
        if (got) return got;
      }
    }
    return null;
  }

  let text = walk(payload) || res.data.snippet || "";
  // Normalize full-width/half-width characters
  text = text.normalize("NFKC");
  return { text, headers, labels };
}

// -----------------------------------------------------------------------------
// Provider detection
// -----------------------------------------------------------------------------

/**
 * Determine which card provider sent the email based on headers, subject
 * or body.  If none match, returns "Unknown".
 */
function detectProvider(
  headers: Record<string, string>,
  subject: string,
  text: string
): Provider {
  const from = (headers["From"] || "").toLowerCase();
  const subj = (subject || "").normalize("NFKC");
  if (from.includes("qa.jcb.co.jp") || subj.includes("JCBカード／ショッピングご利用のお知らせ")) {
    return "JCB";
  }
  if (from.includes("rakuten-card.co.jp") || subj.includes("楽天カード") || text.includes("楽天カード")) {
    return "Rakuten";
  }
  return "Unknown";
}

// -----------------------------------------------------------------------------
// Regex patterns for JCB emails
// -----------------------------------------------------------------------------

// Extract amount from JCB usage notification (e.g. 【ご利用金額】3,282円)
const reJcbAmount = /【?ご利用金額】?\s*([\d,]+)\s*円/;
// Extract merchant from JCB usage notification (e.g. 【ご利用先】JCBクレジットご利用分（海外利用分）)
const reJcbMerchant = /【?ご利用先】?\s*([^\n\r]+)/;
// Extract date/time from JCB usage notification.  Time component is optional.
const reJcbDate = /【?ご利用日時（?日本時間）?】?\s*(\d{4}\/\d{2}\/\d{2})\s*(\d{2}:\d{2})?/;

function parseJCB(text: string) {
  const amount = (reJcbAmount.exec(text)?.[1] || "").replace(/,/g, "");
  const merchant = (reJcbMerchant.exec(text)?.[1] || "").trim();
  const d = reJcbDate.exec(text);
  const date = d ? `${d[1].replace(/\//g, '-')}${d[2] ? " " + d[2] : " 00:00"}` : undefined;
  return {
    amount: amount ? parseInt(amount, 10) : null,
    merchantRaw: merchant || undefined,
    occurredAt: date,
    cardName: /カード名称\s*：\s*([^\n]+)/.exec(text)?.[1]?.trim(),
  };
}

// -----------------------------------------------------------------------------
// Regex patterns for Rakuten emails
// -----------------------------------------------------------------------------

const reRakuAmount = /ご利用金額[：:]*\s*([\d,]+)\s*円/;
const reRakuMerchant = /(ご利用先|ご利用店名)[：:]*\s*([^\n\r]+)/;
const reRakuDate = /ご利用日[：:]*\s*(\d{4}\/\d{1,2}\/\d{1,2})/;

function parseRakuten(text: string) {
  const amount = (reRakuAmount.exec(text)?.[1] || "").replace(/,/g, "");
  const merchant = (reRakuMerchant.exec(text)?.[2] || "").trim();
  const d = reRakuDate.exec(text)?.[1];
  return {
    amount: amount ? parseInt(amount, 10) : null,
    merchantRaw: merchant || undefined,
    occurredAt: d ? `${normalizeYMD(d)} 00:00` : undefined,
    cardName: /カード名称[：:].*?([^\n]+)/.exec(text)?.[1]?.trim(),
  };
}

// -----------------------------------------------------------------------------
// Normalization & heuristics
// -----------------------------------------------------------------------------

/**
 * Normalize merchant names by applying Unicode normalization, removing
 * boilerplate text (e.g. "JCBクレジットご利用分（海外利用分）"), stripping
 * brackets and applying manual corrections for common mis-encodings.
 */
function normalizeMerchant(raw?: string): { merchant: string; merchantNorm: string } {
  let m = (raw || "").normalize("NFKC");
  // Remove generic phrases and bracketed extras
  m = m.replace(/JCBクレジットご利用分/g, "").replace(/（海外利用分）/g, "").replace(/[（）]/g, "").trim();
  // Fix common mis-spellings and garbled characters
  const fixes: Record<string, string> = {
    "ロケツトナウ": "ロケットナウ",
    "ニホンマクドナルド": "マクドナルド",
    "ネツトフリツクス": "ネットフリックス",
  };
  if (fixes[m]) m = fixes[m];
  const merchant = m || raw || "";
  const merchantNorm = merchant.toLowerCase();
  return { merchant, merchantNorm };
}

/**
 * Determine if a merchant is a known subscription service by keyword.
 */
function isKnownSubscriptionByKeyword(merchantNorm: string): boolean {
  const kws = [
    "netflix",
    "ネットフリックス",
    "spotify",
    "youtube",
    "premium",
    "apple",
    "apple.com/bill",
    "adobe",
    "microsoft",
    "google",
    "prime",
    "amazon music",
    "hulu",
    "u-next",
  ];
  return kws.some((k) => merchantNorm.includes(k));
}

/**
 * Initial heuristic: mark as potential subscription if the provider is JCB
 * and the raw merchant contains "海外利用分" (overseas use), or if the
 * normalized merchant name matches a known subscription keyword.
 */
function prelimSubscriptionFlag(
  provider: Provider,
  merchantRaw: string,
  merchantNorm: string
): boolean {
  if (provider === "JCB" && /海外利用分/.test(merchantRaw)) return true;
  if (isKnownSubscriptionByKeyword(merchantNorm)) return true;
  return false;
}

/**
 * Categorize a transaction into spending categories based on merchant and
 * subscription flag.  Transportation keywords take precedence, followed
 * by food-related keywords.  If prelimSub is true, categorize as
 * subscription (サブすく) unless explicitly handled by other categories.
 */
function categorize(
  merchant: string,
  merchantNorm: string,
  prelimSub: boolean
): Category {
  const transportKW = [
    "pasmo",
    "モバイルpasmo",
    "suica",
    "チャージ",
    "jr",
    "東京メトロ",
    "小田急",
    "京王",
    "都営",
    "バス",
  ];
  if (transportKW.some((k) => merchantNorm.includes(k))) return "交通費";

  const foodKW = [
    "マクドナルド",
    "松屋",
    "吉野家",
    "すき家",
    "モス",
    "ケンタッキー",
    "サイゼ",
    "ガスト",
    "びっくりドンキー",
    "ローソン",
    "セブン",
    "ファミマ",
    "からあげ",
    "ラーメン",
    "うどん",
    "そば",
    "寿司",
    "カフェ",
    "ドトール",
    "スタバ",
  ];
  if (foodKW.some((k) => merchant.includes(k) || merchantNorm.includes(k.toLowerCase()))) {
    return "食費";
  }

  if (prelimSub) return "サブすく";
  return "その他";
}

// -----------------------------------------------------------------------------
// Core: fetch + parse
// -----------------------------------------------------------------------------

/**
 * Fetch credit-card notification emails from Gmail and parse them into
 * Transaction objects.  Supports JCB and Rakuten cards.  Uses a search
 * query targeting the card issuers and time window.  Optionally caps
 * the total number of messages processed.
 */
export async function fetchAndParseTransactions(
  gmail: gmail_v1.Gmail,
  opts: ParseOptions = { newerThanDays: 90, maxMessages: 400 }
): Promise<Transaction[]> {
  const newer = opts.newerThanDays ?? 90;
  const max = opts.maxMessages ?? 400;

  // Separate queries per provider so we can cap results evenly.
  const queries = [
    `from:qa.jcb.co.jp subject:(ご利用) newer_than:${newer}d`,
    `from:rakuten-card.co.jp (ご利用 OR 利用) newer_than:${newer}d`,
  ];

  const transactions: Transaction[] = [];
  for (const q of queries) {
    const ids = await listMessageIds(gmail, q, Math.floor(max / queries.length));
    for (const id of ids) {
      try {
        const { text, headers } = await getMessageBody(gmail, id);
        const subject = headers["Subject"] || "";
        const from = headers["From"] || "";
        const provider = detectProvider(headers, subject, text);
        let amount: number | null = null;
        let merchantRaw = "";
        let occurredAt: string | undefined;
        let cardName: string | undefined;

        if (provider === "JCB") {
          const p = parseJCB(text);
          amount = p.amount;
          merchantRaw = p.merchantRaw || "JCBクレジットご利用分（海外利用分）";
          occurredAt = p.occurredAt;
          cardName = p.cardName;
        } else if (provider === "Rakuten") {
          const p = parseRakuten(text);
          amount = p.amount;
          merchantRaw = p.merchantRaw || "";
          occurredAt = p.occurredAt;
          cardName = p.cardName;
        } else {
          const amt = /([\d,]+)\s*円/.exec(text)?.[1]?.replace(/,/g, "");
          amount = amt ? parseInt(amt, 10) : null;
          const m = /(ご利用先|ご利用店名|利用先)[：:]*\s*([^\n\r]+)/.exec(text)?.[2];
          merchantRaw = (m || "").trim();
          occurredAt = undefined;
        }

        const { merchant, merchantNorm } = normalizeMerchant(merchantRaw);
        const prelimSub = prelimSubscriptionFlag(provider, merchantRaw, merchantNorm);
        const category = categorize(merchant, merchantNorm, prelimSub);
        const emailTs = headers["Date"] ? new Date(headers["Date"]).toISOString() : undefined;

        transactions.push({
          id,
          emailTs,
          sender: from,
          provider,
          cardName,
          amount,
          merchantRaw,
          merchant,
          merchantNorm,
          occurredAt,
          subject,
          isSubscriptionCandidate: prelimSub,
          category,
        });
      } catch (e) {
        // Swallow parse errors for robustness during development
      }
    }
  }
  return transactions;
}

// -----------------------------------------------------------------------------
// Subscription refinement
// -----------------------------------------------------------------------------

/**
 * Refine preliminary subscription flags by grouping transactions by provider
 * and merchant, then looking at the distribution of amounts across months.
 *
 * A group is promoted to subscription if it spans multiple months and
 * the standard deviation of the amounts is below a threshold.  For
 * overseas JCB charges (merchantRaw contains "海外利用分"), we use a
 * higher threshold of max(300 JPY, 20% of the mean) to account for
 * exchange-rate fluctuations.  Otherwise we use max(100 JPY, 15% of the
 * mean).
 */
export function refineSubscriptionFlags(transactions: Transaction[]): Transaction[] {
  const byKey = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = `${t.provider}__${t.merchantNorm || t.merchant}`;
    const arr = byKey.get(key) || [];
    arr.push(t);
    byKey.set(key, arr);
  }
  for (const [, arr] of byKey) {
    const amts = arr
      .map((t) => (typeof t.amount === "number" ? t.amount : NaN))
      .filter((x) => !isNaN(x));
    if (amts.length >= 2) {
      const avg = amts.reduce((a, b) => a + b, 0) / amts.length;
      const sd = Math.sqrt(
        amts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amts.length,
      );
      // Distinct months represented by this group
      const months = new Set(
        arr.map((t) => (t.emailTs ? toMonth(t.emailTs) : t.occurredAt ? toMonth(t.occurredAt) : "")),
      );
      // Relax threshold for overseas JCB charges; otherwise use default
      const relaxed = arr.some((t) => /海外利用分/.test(t.merchantRaw || ""))
        ? Math.max(300, 0.2 * avg)
        : Math.max(100, 0.15 * avg);
      if (months.size >= 2 && sd <= relaxed) {
        for (const t of arr) t.isSubscriptionCandidate = true;
        for (const t of arr) if (t.category === "その他") t.category = "サブすく";
      }
    }
  }
  return transactions;
}

// -----------------------------------------------------------------------------
// Aggregation
// -----------------------------------------------------------------------------

/**
 * Aggregate transactions by month and provider, summing both total and
 * category-specific spending.  Returns rows sorted by month and provider.
 */
export function aggregateMonthly(transactions: Transaction[]): MonthlySummaryRow[] {
  const rows = new Map<string, MonthlySummaryRow>();
  for (const t of transactions) {
    const month = t.emailTs ? toMonth(t.emailTs) : t.occurredAt ? toMonth(t.occurredAt) : "";
    const key = `${month}__${t.provider}`;
    const cur =
      rows.get(key) || {
        month,
        provider: t.provider,
        total: 0,
        byCategory: { 交通費: 0, 食費: 0, サブすく: 0, その他: 0 },
        txCount: 0,
      };
    const amt = t.amount || 0;
    cur.total += amt;
    cur.byCategory[t.category] += amt;
    cur.txCount += 1;
    rows.set(key, cur);
  }
  return Array.from(rows.values()).sort((a, b) => {
    if (a.month < b.month) return -1;
    if (a.month > b.month) return 1;
    return a.provider.localeCompare(b.provider);
  });
}

// -----------------------------------------------------------------------------
// Date helpers
// -----------------------------------------------------------------------------

/** Normalize dates of the form YYYY/MM/DD or YYYY-M-D into YYYY-MM-DD. */
function normalizeYMD(input: string): string {
  const parts = input.replace(/\./g, "-").replace(/\//g, "-").split("-");
  if (parts.length < 3) return input;
  const [y, m, d] = parts;
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/** Convert an ISO string or a date-like string into a YYYY-MM representation. */
function toMonth(input: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 7);
  if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(input)) return normalizeYMD(input.slice(0, 10)).slice(0, 7);
  const d = new Date(input);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 7);
  return "";
}
