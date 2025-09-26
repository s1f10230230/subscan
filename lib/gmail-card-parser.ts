// gmail-card-parser.ts (integrated)
// Parse credit card usage emails (JCB / Rakuten Card) from Gmail, extract amount/merchant/date,
// detect subscriptions (including JCB "海外利用分" $20 patterns), and aggregate monthly totals by card & category.

import { google, gmail_v1 } from "googleapis";

export type Provider = "JCB" | "Rakuten" | "Unknown";
export type Category = "交通費" | "食費" | "サブすく" | "その他";

export interface Transaction {
  id: string; // Gmail message id
  emailTs?: string; // RFC3339
  sender?: string; // From header
  provider: Provider;
  cardName?: string; // if parsable from body
  amount: number | null; // JPY
  merchantRaw?: string;
  merchant: string; // normalized
  merchantNorm: string; // lowercased NFKC
  occurredAt?: string; // yyyy-MM-dd HH:mm (local)
  labels?: string[];
  subject?: string;
  isSubscriptionCandidate: boolean; // preliminary (keyword/overseas-based)
  category: Category;
}

export interface MonthlySummaryRow {
  month: string; // YYYY-MM
  provider: Provider;
  total: number;
  byCategory: Record<Category, number>;
  txCount: number;
}

export interface ParseOptions {
  newerThanDays?: number; // Gmail search window
  maxMessages?: number;   // cap for each provider search
}

// ===== OAuth helper (example) =====
export function getGmailClientFromAccessToken(accessToken: string) {
  const oAuth2Client = new google.auth.OAuth2();
  oAuth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth: oAuth2Client });
}

// ===== Gmail fetchers =====
async function listMessageIds(
  gmail: gmail_v1.Gmail,
  q: string,
  max = 200
): Promise<string[]> {
  let pageToken: string | undefined = undefined;
  const ids: string[] = [];
  do {
    const res = await gmail.users.messages.list({ userId: "me", q, pageToken, maxResults: Math.min(100, max) });
    const messages = res.data.messages || [];
    ids.push(...messages.map((m) => m.id!).filter(Boolean));
    pageToken = res.data.nextPageToken || undefined;
    if (ids.length >= max) break;
  } while (pageToken);
  return ids.slice(0, max);
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const buff = Buffer.from(normalized, "base64");
  return buff.toString("utf8");
}

function stripHtml(html: string): string {
  return html.replace(/<\s*br\s*\/?>(?=\s|$)/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n");
}

async function getMessageBody(gmail: gmail_v1.Gmail, id: string): Promise<{ text: string; headers: Record<string,string>; labels: string[] }>
{
  const res = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  const payload = res.data.payload;
  const headersArr = payload?.headers || [];
  const headers: Record<string,string> = {};
  for (const h of headersArr) if (h.name && h.value) headers[h.name] = h.value;
  const labels = res.data.labelIds || [];

  // Prefer text/plain, fallback to text/html, then snippet
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
  // Normalize unicode width etc.
  text = text.normalize("NFKC");
  return { text, headers, labels };
}

// ===== Provider detection =====
function detectProvider(headers: Record<string,string>, subject: string, text: string): Provider {
  const from = (headers["From"] || "").toLowerCase();
  const subj = (subject || "").normalize("NFKC");
  if (from.includes("qa.jcb.co.jp") || subj.includes("JCBカード／ショッピングご利用のお知らせ")) return "JCB";
  if (from.includes("rakuten-card.co.jp") || subj.includes("楽天カード") || text.includes("楽天カード")) return "Rakuten";
  return "Unknown";
}

// ===== JCB parser =====
const reJcbAmount = /【?ご利用金額】?\s*([\d,]+)\s*円/;
const reJcbMerchant = /【?ご利用先】?\s*([^\n\r]+)/;
const reJcbDate = /【?ご利用日時（?日本時間）?】?\s*(\d{4}\/\d{2}\/\d{2})\s*(\d{2}:\d{2})?/; // time optional

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

// ===== Rakuten parser =====
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

// ===== Normalization & heuristics =====
function normalizeMerchant(raw?: string): { merchant: string; merchantNorm: string } {
  let m = (raw || "").normalize("NFKC");
  m = m.replace(/JCBクレジットご利用分/g, "").replace(/（海外利用分）/g, "").replace(/[（）]/g, "").trim();
  const fixes: Record<string,string> = {
    "ロケツトナウ": "ロケットナウ",
    "ニホンマクドナルド": "マクドナルド",
    "ネツトフリツクス": "ネットフリックス",
  };
  if (fixes[m]) m = fixes[m];
  const merchant = m || raw || "";
  const merchantNorm = merchant.toLowerCase();
  return { merchant, merchantNorm };
}

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

function prelimSubscriptionFlag(provider: Provider, merchantRaw: string, merchantNorm: string): boolean {
  if (provider === "JCB" && /海外利用分/.test(merchantRaw)) return true;
  if (isKnownSubscriptionByKeyword(merchantNorm)) return true;
  return false;
}

function categorize(merchant: string, merchantNorm: string, prelimSub: boolean): Category {
  const transportKW = ["pasmo", "モバイルpasmo", "suica", "チャージ", "jr", "東京メトロ", "小田急", "京王", "都営", "バス"];
  if (transportKW.some(k => merchantNorm.includes(k))) return "交通費";

  const foodKW = ["マクドナルド", "松屋", "吉野家", "すき家", "モス", "ケンタッキー", "サイゼ", "すき家", "ガスト", "びっくりドンキー", "ローソン", "セブン", "ファミマ", "からあげ", "ラーメン", "うどん", "そば", "寿司", "カフェ", "ドトール", "スタバ"];
  if (foodKW.some(k => merchant.includes(k) || merchantNorm.includes(k.toLowerCase()))) return "食費";

  if (prelimSub) return "サブすく";
  return "その他";
}

// ===== Core: fetch + parse =====
export async function fetchAndParseTransactions(
  gmail: gmail_v1.Gmail,
  opts: ParseOptions = { newerThanDays: 90, maxMessages: 400 }
): Promise<Transaction[]> {
  const newer = opts.newerThanDays ?? 90;
  const max = opts.maxMessages ?? 400;

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

// ===== Subscription refinement =====
export function refineSubscriptionFlags(transactions: Transaction[]): Transaction[] {
  const byKey = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const key = `${t.provider}__${t.merchantNorm || t.merchant}`;
    const arr = byKey.get(key) || [];
    arr.push(t);
    byKey.set(key, arr);
  }

  for (const [, arr] of byKey) {
    const amts = arr.map((t) => (typeof t.amount === "number" ? t.amount : NaN)).filter((x) => !isNaN(x));
    if (amts.length >= 2) {
      const avg = amts.reduce((a, b) => a + b, 0) / amts.length;
      const sd = Math.sqrt(amts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amts.length);
      const months = new Set(arr.map((t) => (t.emailTs ? toMonth(t.emailTs) : (t.occurredAt ? toMonth(t.occurredAt) : ""))));

      const relaxed = arr.some((t) => /海外利用分/.test(t.merchantRaw || "")) ? Math.max(250, 0.2 * avg) : Math.max(100, 0.15 * avg);

      if (months.size >= 2 && sd <= relaxed) {
        for (const t of arr) t.isSubscriptionCandidate = true;
        for (const t of arr) if (t.category === "その他") t.category = "サブすく";
      }
    }
  }
  return transactions;
}

// ===== Aggregation =====
export function aggregateMonthly(transactions: Transaction[]): MonthlySummaryRow[] {
  const rows = new Map<string, MonthlySummaryRow>();
  for (const t of transactions) {
    const month = t.emailTs ? toMonth(t.emailTs) : (t.occurredAt ? toMonth(t.occurredAt) : "");
    const key = `${month}__${t.provider}`;
    const cur = rows.get(key) || {
      month,
      provider: t.provider,
      total: 0,
      byCategory: { "交通費": 0, "食費": 0, "サブすく": 0, "その他": 0 },
      txCount: 0,
    };
    const amt = t.amount || 0;
    cur.total += amt;
    cur.byCategory[t.category] += amt;
    cur.txCount += 1;
    rows.set(key, cur);
  }
  return Array.from(rows.values()).sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : a.provider.localeCompare(b.provider)));
}

// ===== Date helpers (no external deps) =====
function normalizeYMD(input: string): string {
  // Accepts 'YYYY/MM/DD' or 'YYYY-M-D' etc. Returns 'YYYY-MM-DD'
  const parts = input.replace(/\./g, '-').replace(/\//g, '-').split('-')
  if (parts.length < 3) return input
  const [y, m, d] = parts
  const mm = m.padStart(2, '0')
  const dd = d.padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function toMonth(input: string): string {
  // input may be ISO string or 'YYYY-MM-DD ...' or 'YYYY/MM/DD ...'
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 7)
  if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(input)) return normalizeYMD(input.slice(0, 10)).slice(0, 7)
  // Try Date parsing
  const d = new Date(input)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 7)
  return ''
}
