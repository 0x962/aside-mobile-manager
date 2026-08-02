import { Bridge } from './bridge';
import type { Settings } from './settings';

export type SessionRow = {
  id: string;
  title: string;
  status: string;
  model: { provider?: string; modelId?: string; thinkingLevel?: string };
  ephemeral: boolean;
  createdAt: number;
  updatedAt: number;
};

// CLI-born sessions all carry the placeholder title "Aside CLI"; the first
// user message identifies them better.
const PLACEHOLDER_TITLES = new Set(['Aside CLI', 'New Session']);

export function displayTitle(title: string, firstMessage: string | null): string {
  if (!PLACEHOLDER_TITLES.has(title) || !firstMessage) return title;
  const line = firstMessage.split('\n')[0].trim();
  return line.length > 64 ? `${line.slice(0, 64)}…` : line || title;
}

export type TranscriptItem =
  | { kind: 'user'; text: string; ts: number }
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; id: string; name: string; title: string; args: string; result: string; isError: boolean; elapsedMs: number | null }
  | { kind: 'system'; label: string; text: string };

export type ModelOption = {
  provider: string;
  providerName: string;
  modelId: string;
  name: string;
};

export type Account = { id: number; name: string; email?: string; authStatus: string };

const contentText = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content))
    return content
      .map((c: any) => (c?.type === 'text' ? c.text : ''))
      .filter(Boolean)
      .join('\n');
  return '';
};

export class Aside {
  bridge: Bridge;
  bin: string;
  home: string;
  account: number;

  constructor(s: Settings) {
    this.bridge = new Bridge(s.bridgeHost);
    this.bin = s.asideBin;
    this.home = s.asideHome;
    this.account = s.account;
  }

  private get db() {
    return `${this.home}/u/${this.account}/state.db`;
  }

  async listSessions(): Promise<SessionRow[]> {
    const sql =
      'select s.id, s.title, s.status, s.model, s.ephemeral, s.created_at, s.updated_at, ' +
      "(select json_extract(r.user_message, '$[0].content[0].text') from session_runs r " +
      ' where r.session_id = s.id order by r.id limit 1) as first_msg ' +
      'from sessions s where s.archived_at is null order by s.updated_at desc limit 100';
    const out = await this.bridge.out(['sqlite3', '-json', '-readonly', this.db, sql]);
    const rows = out.trim() ? JSON.parse(out) : [];
    return rows.map((r: any) => ({
      id: r.id,
      title: displayTitle(r.title, r.first_msg),
      status: r.status,
      model: safeJson(r.model),
      ephemeral: r.ephemeral === 1,
      createdAt: r.created_at * 1000,
      updatedAt: r.updated_at * 1000,
    }));
  }

  async sessionMeta(sessionId: string): Promise<{ title: string; modelId?: string; thinkingLevel?: string }> {
    const safe = sessionId.replace(/'/g, '');
    const sql =
      `select s.title, s.model, (select json_extract(r.user_message, '$[0].content[0].text') ` +
      `from session_runs r where r.session_id = s.id order by r.id limit 1) as first_msg ` +
      `from sessions s where s.id='${safe}'`;
    const out = await this.bridge.out(['sqlite3', '-json', '-readonly', this.db, sql]);
    const row = JSON.parse(out.trim() || '[{}]')[0] ?? {};
    const model = safeJson(row.model ?? '{}');
    return {
      title: displayTitle(row.title ?? '', row.first_msg ?? null),
      modelId: model.modelId,
      thinkingLevel: model.thinkingLevel,
    };
  }

  async newestSessionId(): Promise<string | null> {
    const sql = 'select id from sessions order by created_at desc, rowid desc limit 1';
    const out = await this.bridge.out(['sqlite3', '-readonly', this.db, sql]);
    return out.trim() || null;
  }

  async transcript(sessionId: string): Promise<TranscriptItem[]> {
    const r = await this.bridge.run([
      'sh',
      '-c',
      `cat ${this.home}/u/${this.account}/sessions/*_${sessionId}/messages.jsonl`,
    ]);
    if (r.code !== 0) return [];
    return parseTranscript(r.stdout);
  }

  private modelFlags(model?: ModelOption | null, effort?: string | null): string[] {
    const flags: string[] = ['--account', String(this.account)];
    if (model) flags.push('-p', model.provider, '-m', model.modelId);
    if (effort) flags.push('--effort', effort);
    return flags;
  }

  async sendMessage(sessionId: string, text: string, model?: ModelOption | null, effort?: string | null) {
    return this.bridge.spawn([this.bin, '--session', sessionId, ...this.modelFlags(model, effort), text]);
  }

  async startSession(text: string, model?: ModelOption | null, effort?: string | null) {
    return this.bridge.spawn([this.bin, ...this.modelFlags(model, effort), text]);
  }

  /** Upload file bytes to the Mac and return the remote path, for use in a prompt. */
  async uploadFile(name: string, base64: string): Promise<string> {
    const safe = name.replace(/[^A-Za-z0-9._-]/g, '_');
    const dir = `${this.home.replace(/\/\.aside$/, '')}/aside-uploads`;
    const path = `${dir}/${Date.now()}-${safe}`;
    await this.bridge.out(['sh', '-c', `mkdir -p ${dir} && base64 -d > ${path}`], { stdin: base64 });
    return path;
  }

  async accounts(): Promise<Account[]> {
    const out = await this.bridge.out(['cat', `${this.home}/accounts.json`]);
    return JSON.parse(out).accounts.map((a: any) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      authStatus: a.authStatus,
    }));
  }

  async models(): Promise<ModelOption[]> {
    const opts: ModelOption[] = [];
    const seen = new Set<string>();
    const add = (provider: string, providerName: string, modelId: string, name?: string) => {
      const key = `${provider}/${modelId}`;
      if (!modelId || seen.has(key)) return;
      seen.add(key);
      opts.push({ provider, providerName, modelId, name: name ?? modelId });
    };

    // Built-in models are not listed in models.json; the sessions table and
    // the settings default reflect what this install can actually run.
    const [modelsJson, sessionModels, settingsJson] = await Promise.all([
      this.bridge.out(['cat', `${this.home}/u/${this.account}/models.json`]),
      this.bridge.out([
        'sqlite3', '-json', '-readonly', this.db,
        "select distinct json_extract(model,'$.provider') as p, json_extract(model,'$.modelId') as m from sessions",
      ]),
      this.bridge.out(['cat', `${this.home}/u/${this.account}/settings.json`]),
    ]);

    const data = safeJson(modelsJson);
    const names: Record<string, string> = {};
    for (const [provider, p] of Object.entries<any>(data.providers ?? {})) {
      if (p.name) names[provider] = p.name;
    }
    const label = (p?: string) => names[p ?? ''] ?? providerLabel(p);

    const def = safeJson(settingsJson)?.defaultModel ?? {};
    if (def.modelId) add(def.provider ?? 'claude-code', label(def.provider), def.modelId, prettyBuiltin(def.modelId));
    for (const r of sessionModels.trim() ? JSON.parse(sessionModels) : []) {
      if (r.p && r.m) add(r.p, label(r.p), r.m, prettyBuiltin(r.m));
    }
    for (const [provider, p] of Object.entries<any>(data.providers ?? {})) {
      for (const m of p.models ?? []) add(provider, label(provider), m.id, m.name);
    }
    return opts;
  }
}

function safeJson(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}

const PROVIDER_LABELS: Record<string, string> = {
  'claude-code': 'Claude',
  anthropic: 'Anthropic',
  'openai-codex': 'OpenAI Codex',
  aside: 'Aside',
};

const providerLabel = (p?: string) => PROVIDER_LABELS[p ?? ''] ?? p ?? 'Other';

function prettyBuiltin(id: string): string {
  return id
    .replace(/^claude-/, '')
    .split('-')
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/(\d) (\d)/g, '$1.$2');
}

export function parseTranscript(jsonl: string): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const toolIndex = new Map<string, number>();
  for (const line of jsonl.split('\n')) {
    if (!line.trim()) continue;
    let m: any;
    try { m = JSON.parse(line); } catch { continue; }
    if (m.role === 'user') {
      items.push({ kind: 'user', text: contentText(m.content), ts: m.timestamp ?? 0 });
    } else if (m.role === 'assistant') {
      for (const c of m.content ?? []) {
        if (c.type === 'text' && c.text?.trim()) items.push({ kind: 'text', text: c.text });
        if (c.type === 'thinking' && c.thinking?.trim()) items.push({ kind: 'thinking', text: c.thinking });
        if (c.type === 'toolCall') {
          toolIndex.set(c.id, items.length);
          items.push({
            kind: 'tool',
            id: c.id,
            name: c.name,
            title: c.arguments?.title ?? '',
            args: typeof c.arguments === 'string' ? c.arguments : JSON.stringify(c.arguments, null, 1),
            result: '',
            isError: false,
            elapsedMs: null,
          });
        }
      }
    } else if (m.role === 'toolResult') {
      const idx = toolIndex.get(m.toolCallId);
      if (idx !== undefined) {
        const t = items[idx] as Extract<TranscriptItem, { kind: 'tool' }>;
        t.result = contentText(m.content);
        t.isError = m.isError === true;
        t.elapsedMs = m.details?.elapsedMs ?? null;
      }
    } else if (m.role === 'system-message') {
      items.push({ kind: 'system', label: m.kind ?? 'system', text: m.content ?? '' });
    }
  }
  return items;
}

export const EFFORTS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultrabrowse'] as const;

// Thinking, tool, and system items are scaffolding while a reply generates.
// Group each contiguous stretch into one trace so the finished transcript
// reads as user text and assistant text.
export type DisplayItem =
  | Extract<TranscriptItem, { kind: 'user' } | { kind: 'text' }>
  | { kind: 'trace'; steps: TranscriptItem[]; toolCount: number; elapsedMs: number };

export function groupTranscript(items: TranscriptItem[], hideTrailingTrace: boolean): DisplayItem[] {
  const out: DisplayItem[] = [];
  let steps: TranscriptItem[] = [];
  const flush = () => {
    if (!steps.length) return;
    out.push({
      kind: 'trace',
      steps,
      toolCount: steps.filter((s) => s.kind === 'tool').length,
      elapsedMs: steps.reduce((sum, s) => sum + (s.kind === 'tool' ? s.elapsedMs ?? 0 : 0), 0),
    });
    steps = [];
  };
  for (const item of items) {
    if (item.kind === 'user' || item.kind === 'text') {
      flush();
      out.push(item);
    } else {
      steps.push(item);
    }
  }
  // A trailing trace belongs to the turn still generating; the live status
  // row already shows its current step.
  if (!hideTrailingTrace) flush();
  return out;
}
