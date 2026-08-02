import { Bridge, type ProcEvent, type ProcSummary } from './bridge';

// Demo mode: a bridge that serves sample data from this phone. The rest of
// the app cannot tell it from a real bridge; every command the app composes
// (sqlite3, cat, aside, sh) gets a plausible answer here.
export const DEMO_HOST = 'demo';

export function bridgeFor(host: string, token = ''): Bridge {
  return host === DEMO_HOST ? new DemoBridge() : new Bridge(host, token);
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

// The prompt redraw sequence the warm pool in runs.ts watches for.
const PROMPT = '\x1b[0J> ';

type DemoSession = {
  id: string;
  title: string;
  status: string;
  model: { provider: string; modelId: string; thinkingLevel?: string };
  ephemeral: boolean;
  createdAt: number;
  updatedAt: number;
  messages: object[];
};

// jsonl row builders in the schema parseTranscript reads.
const user = (text: string, ts: number) => ({ role: 'user', content: [{ type: 'text', text }], timestamp: ts });
const assistant = (...content: object[]) => ({ role: 'assistant', content });
const think = (t: string) => ({ type: 'thinking', thinking: t });
const tool = (id: string, name: string, title: string, args: object) => ({
  type: 'toolCall',
  id,
  name,
  arguments: { title, ...args },
});
const toolResult = (id: string, text: string, elapsedMs: number) => ({
  role: 'toolResult',
  toolCallId: id,
  content: [{ type: 'text', text }],
  isError: false,
  details: { elapsedMs },
});
const say = (t: string) => ({ type: 'text', text: t });

const FABLE = { provider: 'claude-code', modelId: 'claude-fable-5' };
const OPUS = { provider: 'claude-code', modelId: 'claude-opus-4-6' };
const SONNET = { provider: 'claude-code', modelId: 'claude-sonnet-5' };

function seedSessions(): DemoSession[] {
  const now = Date.now();
  return [
    {
      id: 'demo-refund',
      title: 'Chase the Northline refund',
      status: 'idle',
      model: { ...FABLE, thinkingLevel: 'high' },
      ephemeral: false,
      createdAt: now - 13 * DAY,
      updatedAt: now - 2 * HOUR,
      messages: [
        user("Any movement on the Northline refund? It's been two weeks.", now - 2 * HOUR - 6 * 60000),
        assistant(
          think('The return shipped on the 14th. Check the inbox for a warehouse confirmation first, then the order page.'),
          tool('t1', 'mail', 'Search inbox for "Northline"', { query: 'from:northline newer_than:14d' }),
        ),
        toolResult('t1', '3 messages. Latest: "Your return has been received" (Jul 28).', 2100),
        assistant(
          tool('t2', 'browser', 'Open the Northline order page', { url: 'https://shop.example.com/orders/48812' }),
        ),
        toolResult('t2', 'Order 48812 · Return received · Refund: pending', 5400),
        assistant(
          say(
            'The return reached their warehouse on **Jul 28**, but the refund still shows *pending*.\n\n' +
              '- Their policy pays out within 14 days of receipt, so the deadline is Aug 11.\n' +
              '- No refund email has arrived yet.\n\n' +
              'I drafted a nudge to their support with the order number and the receipt date. Want me to send it?',
          ),
        ),
        user('Send it.', now - 2 * HOUR),
        assistant(tool('t3', 'mail', 'Send the draft to Northline support', { draftId: 'r-8812' })),
        toolResult('t3', 'Sent to support@northline.example.', 1200),
        assistant(say('Sent. I will check the order page again on Friday and flag any refund email sooner.')),
      ],
    },
    {
      id: 'demo-inbox',
      title: 'Morning inbox sweep',
      status: 'idle',
      model: { ...FABLE, thinkingLevel: 'medium' },
      ephemeral: false,
      createdAt: now - 5 * HOUR,
      updatedAt: now - 30 * 60000,
      messages: [
        user('Anything in the inbox this morning that needs me?', now - 32 * 60000),
        assistant(
          think('Scan unread from the last 12 hours, split what needs a reply from noise.'),
          tool('t1', 'mail', 'List unread from the last 12 hours', { query: 'is:unread newer_than:12h' }),
        ),
        toolResult('t1', '9 unread. 2 personal, 1 billing, 6 promotions.', 1900),
        assistant(
          say(
            'Two things need you, the rest was noise:\n\n' +
              '1. **The accountant** asked for your Q2 invoices by Friday.\n' +
              '2. **The landlord** confirmed the boiler visit for Thursday 9–11am, wants a yes/no.\n\n' +
              'The billing mail was the normal electricity direct debit. I archived the promotions.',
          ),
        ),
      ],
    },
    {
      id: 'demo-dentist',
      title: 'Reschedule the dentist',
      status: 'idle',
      model: { ...OPUS },
      ephemeral: false,
      createdAt: now - DAY - 3 * HOUR,
      updatedAt: now - DAY - 2 * HOUR,
      messages: [
        user('Move my Tuesday dentist appointment to any morning next week.', now - DAY - 3 * HOUR),
        assistant(
          think('The practice uses an online booking portal. Log in, cancel Tuesday, take the earliest morning slot.'),
          tool('t1', 'browser', 'Rebook at the dental portal', { url: 'https://booking.smiledental.example/appointments' }),
        ),
        toolResult('t1', 'Cancelled Tue 10:30. Booked Wed 9:15 next week. Confirmation #D-2291.', 44000),
        assistant(
          say('Done. Tuesday is cancelled and you now have **Wednesday 9:15** next week, confirmation #D-2291. The portal sent a confirmation email and I added it to your calendar.'),
        ),
      ],
    },
    {
      id: 'demo-insurance',
      title: 'Car insurance quotes',
      status: 'idle',
      model: { ...SONNET },
      ephemeral: false,
      createdAt: now - DAY - 8 * HOUR,
      updatedAt: now - DAY - 7 * HOUR,
      messages: [
        user('My car insurance renews at $118/mo. Find me something cheaper, same coverage.', now - DAY - 8 * HOUR),
        assistant(
          think('Pull the current policy limits from the insurer portal, then run two comparison sites with the same limits.'),
          tool('t1', 'browser', 'Compare quotes with current coverage limits', { sites: ['comparison A', 'comparison B'] }),
        ),
        toolResult('t1', 'Best matches: $89/mo and $94/mo with identical limits and deductible.', 187000),
        assistant(
          say(
            'Two real options with your exact limits and $500 deductible:\n\n' +
              '- **$89/mo** – needs a 12-month commitment.\n' +
              '- **$94/mo** – month to month.\n\n' +
              'Both quotes are saved as PDFs in your downloads. The $89 one expires in 10 days.',
          ),
        ),
      ],
    },
    {
      id: 'demo-gym',
      title: 'Cancel the gym membership',
      status: 'idle',
      model: { ...FABLE },
      ephemeral: false,
      createdAt: now - 4 * DAY,
      updatedAt: now - 4 * DAY + HOUR,
      messages: [
        user("Cancel my Pulse gym membership. I haven't gone since March.", now - 4 * DAY),
        assistant(
          think('Their site hides cancellation behind a form. Check the contract end date first to avoid a fee.'),
          tool('t1', 'browser', 'Submit the cancellation form', { url: 'https://members.pulsegym.example/cancel' }),
        ),
        toolResult('t1', 'Form submitted. Membership ends Aug 31, no early-exit fee.', 92000),
        { role: 'system-message', kind: 'reminder', content: 'Watch the next two bank statements for further Pulse charges.' },
        assistant(
          say('Cancelled. The contract runs to **Aug 31** and there is no exit fee. I set a reminder to check your next two statements for stray charges.'),
        ),
      ],
    },
    {
      id: 'demo-taxes',
      title: 'Collect tax documents',
      status: 'idle',
      model: { ...OPUS, thinkingLevel: 'high' },
      ephemeral: false,
      createdAt: now - 12 * DAY,
      updatedAt: now - 12 * DAY + 2 * HOUR,
      messages: [
        user('Gather everything the accountant needs for the Q2 filing into one folder.', now - 12 * DAY),
        assistant(
          think('Sources: bank statements, the payroll portal, three invoice emails, and the brokerage tax page.'),
          tool('t1', 'browser', 'Download statements and payroll PDFs', { count: 7 }),
        ),
        toolResult('t1', '7 PDFs saved to ~/Documents/taxes-q2/.', 240000),
        assistant(
          say('All 7 documents are in `~/Documents/taxes-q2/`: two bank statements, three invoices, the payroll summary, and the brokerage 1099 draft. Zipped copy is on your desktop.'),
        ),
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Canned replies for live demo turns.
// ---------------------------------------------------------------------------

type DemoStep =
  | { think: string }
  | { tool: { name: string; title: string; args: object; result: string; elapsedMs: number } };

type DemoReply = { steps: DemoStep[]; reply: string };

const t$ = (name: string, title: string, args: object, result: string, elapsedMs: number): DemoStep => ({
  tool: { name, title, args, result, elapsedMs },
});

function respond(text: string): DemoReply {
  const t = text.toLowerCase();
  if (t.includes('tab'))
    return {
      steps: [
        { think: 'One browser window, four tabs. Read each one, then group by what needs action.' },
        t$('browser', 'List open tabs', { action: 'tabs.list' }, '4 tabs: mail, a store order, a flight tracker, a forum thread', 1800),
        t$('browser', 'Read the mail tab', { action: 'tab.read', tab: 1 }, '2 unread; one from the accountant about Q2 invoices.', 2600),
        t$('browser', 'Read the Flights tab', { action: 'tab.read', tab: 3 }, 'BOS→SFO Sep 12, tracked fare currently $214.', 2100),
        { think: 'Nothing here is urgent; the accountant email matters most.' },
      ],
      reply:
        'Four tabs are open:\n\n' +
        '- **Mail** – two unread, one from the accountant.\n' +
        '- **A store order** – arrives tomorrow.\n' +
        '- **A flight tracker** – BOS to SFO Sep 12, fare at $214.\n' +
        '- **A forum thread** – on local-first software.\n\n' +
        '*Demo data. Connect a machine that runs Aside to see your real tabs.*',
    };
  if (t.includes('inbox') || t.includes('email') || t.includes('mail'))
    return {
      steps: [
        { think: 'Scan unread from the last day, split what needs a reply from noise.' },
        t$('mail', 'Search unread mail', { query: 'is:unread newer_than:1d' }, '6 unread. 1 needs a reply, 1 billing, 4 promotions.', 2400),
        t$('mail', 'Read the landlord thread', { threadId: 'th-1182' }, 'Boiler visit Thursday 9–11am. Wants a yes/no.', 1900),
        t$('mail', 'Archive the promotions', { count: 4 }, 'Archived 4 messages.', 900),
        { think: 'Only the landlord thread needs an answer; the bill is the usual direct debit.' },
      ],
      reply:
        'One thing needs you: the **landlord** wants a yes/no on the Thursday boiler visit. The rest was a routine bill and four promotions, which I archived.\n\n*Demo data. On your own machine this runs against your real inbox.*',
    };
  if (t.includes('return') || t.includes('refund'))
    return {
      steps: [
        { think: 'Check the inbox for a refund confirmation first, then the order page.' },
        t$('mail', 'Search for a refund confirmation', { query: 'from:northline refund' }, 'No refund email yet.', 1600),
        t$('browser', 'Check the order page', { url: 'https://shop.example.com/orders/48812' }, 'Order 48812 · Refund: pending · deadline Aug 11', 4800),
        { think: 'Still pending, and the nudge already went out earlier today. Nothing more to send.' },
      ],
      reply:
        'Still *pending* on the order page. Their 14-day payout window closes **Aug 11**; the nudge email went out earlier today. I will flag any refund confirmation the moment it lands.\n\n*Demo data.*',
    };
  if (t.includes('today') || t.includes('session'))
    return {
      steps: [
        { think: 'Summarize what the recent sessions did.' },
        t$('repl', 'Read today’s session list', { query: 'sessions updated today' }, '2 sessions today: inbox sweep, refund chase.', 1200),
        t$('repl', 'Read both transcripts', { sessions: 2 }, 'Inbox: 2 items need action. Refund: nudge sent, deadline Aug 11.', 2100),
      ],
      reply:
        'Today:\n\n' +
        '- **Morning inbox sweep** – two items need you: the accountant (Q2 invoices by Friday) and the landlord (boiler visit yes/no).\n' +
        '- **Chase the Northline refund** – nudge email sent, payout deadline Aug 11.\n\n' +
        'Earlier this week the dentist move and the gym cancellation both completed.\n\n*Demo data.*',
    };
  return {
    steps: [
      { think: 'The demo has no live browser. Explain what a real session would do.' },
      t$('browser', 'Open a browser tab', { action: 'tab.new' }, 'demo: no live browser, sample data only', 700),
      { think: 'Answer from the sample data and point at the real setup.' },
    ],
    reply:
      'In demo mode I work from sample data on this phone, so I cannot act on that.\n\n' +
      'On a connected machine, Aside would open its browser and do this with your own logins:\n\n' +
      `> ${text.trim().split('\n')[0]}\n\n` +
      'Install the bridge on the machine that runs Aside, then exit the demo and scan again.',
  };
}

// ---------------------------------------------------------------------------
// The demo bridge.
// ---------------------------------------------------------------------------

type Listener = (ev: ProcEvent) => void;

type DemoProc = {
  id: string;
  argv: string[];
  startedAt: number;
  exitedAt: number | null;
  exitCode: number | null;
  running: boolean;
  kind: 'warm' | 'turn';
  sessionId: string;
  buffer: string;
  listeners: Set<Listener>;
  timers: ReturnType<typeof setTimeout>[];
};

// Module-level so navigation and screen remounts share one demo world.
const state = { sessions: [] as DemoSession[], procs: new Map<string, DemoProc>(), seq: 0 };

function sessions(): DemoSession[] {
  if (!state.sessions.length) state.sessions = seedSessions();
  return state.sessions;
}

function emit(p: DemoProc, ev: ProcEvent) {
  if (ev.type === 'data') p.buffer += ev.text;
  for (const l of p.listeners) l(ev);
}

function schedule(p: DemoProc, delay: number, fn: () => void) {
  p.timers.push(setTimeout(fn, delay));
}

function summary(p: DemoProc): ProcSummary {
  return { id: p.id, argv: p.argv, startedAt: p.startedAt, exitedAt: p.exitedAt, exitCode: p.exitCode, running: p.running };
}

function endProc(p: DemoProc, code: number) {
  if (!p.running) return;
  p.running = false;
  p.exitedAt = Date.now();
  p.exitCode = code;
  for (const t of p.timers) clearTimeout(t);
  p.timers = [];
  emit(p, { type: 'exit', code });
}

function firstUserText(s: DemoSession): string | null {
  const m = s.messages.find((r: any) => r.role === 'user') as any;
  return m?.content?.[0]?.text ?? null;
}

function newSession(argv: string[]): DemoSession {
  const flag = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const now = Date.now();
  const s: DemoSession = {
    id: `demo-${(state.seq++).toString(36)}${now.toString(36).slice(-4)}`,
    // The CLI placeholder title; the session list falls back to the first message.
    title: 'Aside CLI',
    status: 'running',
    model: {
      provider: flag('-p') ?? FABLE.provider,
      modelId: flag('-m') ?? FABLE.modelId,
      thinkingLevel: flag('--effort'),
    },
    ephemeral: true,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  sessions().push(s);
  return s;
}

// Play the response's steps one by one: each shows as a ticker line and lands
// in the transcript as it happens, like a real turn. The reply follows, then
// the process settles: a prompt redraw for warm procs, exit 0 for one-shot.
function simulateTurn(p: DemoProc, text: string) {
  const session = sessions().find((s) => s.id === p.sessionId);
  if (!session) return endProc(p, 1);
  const r = respond(text);
  session.messages.push(user(text, Date.now()));
  session.status = 'running';
  session.updatedAt = Date.now();

  let at = 400;
  for (const step of r.steps) {
    schedule(p, at, () => {
      if ('think' in step) {
        emit(p, { type: 'data', text: `Thinking: ${step.think}\n` });
        session.messages.push(assistant(think(step.think)));
      } else {
        emit(p, { type: 'data', text: `${step.tool.title}…\n` });
        const id = `d${state.seq++}`;
        session.messages.push(assistant(tool(id, step.tool.name, step.tool.title, step.tool.args)));
        session.messages.push(toolResult(id, step.tool.result, step.tool.elapsedMs));
      }
      session.updatedAt = Date.now();
    });
    at += 1000 + Math.floor(Math.random() * 700);
  }
  schedule(p, at + 300, () => {
    session.messages.push(assistant(say(r.reply)));
    session.status = 'idle';
    session.updatedAt = Date.now();
    if (p.kind === 'warm') emit(p, { type: 'data', text: `\nWorked for a moment\n${PROMPT}` });
    else endProc(p, 0);
  });
}

// Interrupt (^C from the stop button): drop pending work, settle idle.
function interrupt(p: DemoProc) {
  for (const t of p.timers) clearTimeout(t);
  p.timers = [];
  const session = sessions().find((s) => s.id === p.sessionId);
  if (session && session.status === 'running') {
    session.status = 'idle';
    session.updatedAt = Date.now();
  }
  if (p.kind === 'warm') emit(p, { type: 'data', text: `\nInterrupted\n${PROMPT}` });
  else endProc(p, 130);
}

function dispatch(argv: string[]): { code: number; stdout: string } {
  const [cmd, ...rest] = argv;

  if (cmd === 'sh' && rest[0] === '-c') {
    const script = rest[1] ?? '';
    if (script.includes('$HOME')) return { code: 0, stdout: '/Users/demo\n' };
    if (script.includes('messages.jsonl')) {
      const id = script.match(/\*_(.+?)\/messages\.jsonl/)?.[1];
      const s = sessions().find((x) => x.id === id);
      if (!s) return { code: 1, stdout: '' };
      return { code: 0, stdout: s.messages.map((m) => JSON.stringify(m)).join('\n') };
    }
    if (script.includes('tailscale')) {
      return {
        code: 0,
        stdout: JSON.stringify({
          Self: { HostName: 'demo-mac', OS: 'macOS', TailscaleIPs: ['100.101.102.103'], Online: true },
          Peer: {},
        }),
      };
    }
    if (script.includes('mkdir -p')) return { code: 0, stdout: '' };
    return { code: 0, stdout: '' };
  }

  if (cmd === 'sqlite3') {
    const sql = argv[argv.length - 1];
    if (sql.includes('archived_at is null')) {
      const rows = sessions()
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          model: JSON.stringify(s.model),
          ephemeral: s.ephemeral ? 1 : 0,
          created_at: Math.floor(s.createdAt / 1000),
          updated_at: Math.floor(s.updatedAt / 1000),
          first_msg: firstUserText(s),
        }));
      return { code: 0, stdout: JSON.stringify(rows) };
    }
    if (sql.includes("where s.id='")) {
      const id = sql.match(/where s\.id='([^']+)'/)?.[1];
      const s = sessions().find((x) => x.id === id);
      if (!s) return { code: 0, stdout: '[]' };
      return {
        code: 0,
        stdout: JSON.stringify([{ title: s.title, model: JSON.stringify(s.model), first_msg: firstUserText(s) }]),
      };
    }
    if (sql.includes('select distinct')) {
      const seen = new Map<string, { p: string; m: string }>();
      for (const s of sessions()) seen.set(`${s.model.provider}/${s.model.modelId}`, { p: s.model.provider, m: s.model.modelId });
      return { code: 0, stdout: JSON.stringify([...seen.values()]) };
    }
    if (sql.startsWith('select id from sessions')) {
      const newest = sessions()
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      return { code: 0, stdout: newest ? `${newest.id}\n` : '' };
    }
    return { code: 0, stdout: '[]' };
  }

  if (cmd === 'cat') {
    const path = rest[0] ?? '';
    if (path.endsWith('accounts.json'))
      return {
        code: 0,
        stdout: JSON.stringify({ accounts: [{ id: 0, name: 'Demo', email: 'demo@example.com', authStatus: 'authenticated' }] }),
      };
    if (path.endsWith('models.json'))
      return {
        code: 0,
        stdout: JSON.stringify({
          providers: { 'openai-codex': { name: 'OpenAI Codex', models: [{ id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex' }] } },
        }),
      };
    if (path.endsWith('settings.json')) return { code: 0, stdout: JSON.stringify({ defaultModel: FABLE }) };
    return { code: 1, stdout: '' };
  }

  if (cmd.endsWith('aside') && rest[0] === '-V') return { code: 0, stdout: '1.26.717 (demo)\n' };

  return { code: 0, stdout: '' };
}

export class DemoBridge extends Bridge {
  constructor() {
    super(DEMO_HOST);
  }

  async health() {
    sessions();
    return {
      ok: true,
      procs: [...state.procs.values()].filter((p) => p.running).length,
      host: 'demo',
      authRequired: false,
      paired: true,
    };
  }

  async run(argv: string[]) {
    const r = dispatch(argv);
    return { code: r.code, signal: null, timedOut: false, stdout: r.stdout, stderr: r.code === 0 ? '' : 'demo: no such file' };
  }

  async spawn(argv: string[]): Promise<ProcSummary> {
    const sessionFlag = argv.indexOf('--session');
    // Warm procs end exactly with `--account <n>`; a trailing free-text
    // argument makes it a one-shot turn.
    const warm = sessionFlag >= 0 && argv[argv.length - 2] === '--account';
    const text = argv[argv.length - 1];

    const p: DemoProc = {
      id: `dp-${state.seq++}`,
      argv,
      startedAt: Date.now(),
      exitedAt: null,
      exitCode: null,
      running: true,
      kind: warm ? 'warm' : 'turn',
      sessionId: sessionFlag >= 0 ? argv[sessionFlag + 1] : '',
      buffer: '',
      listeners: new Set(),
      timers: [],
    };
    state.procs.set(p.id, p);

    if (warm) {
      schedule(p, 250, () => emit(p, { type: 'data', text: `Aside CLI · demo\n${PROMPT}` }));
    } else {
      if (!p.sessionId) p.sessionId = newSession(argv).id;
      simulateTurn(p, text);
    }
    return summary(p);
  }

  async procs(): Promise<ProcSummary[]> {
    return [...state.procs.values()].map(summary);
  }

  async proc(id: string) {
    const p = state.procs.get(id);
    if (!p) throw new Error('no such proc');
    return { ...summary(p), output: p.buffer };
  }

  async kill(id: string) {
    const p = state.procs.get(id);
    if (p) endProc(p, 0);
  }

  attach(id: string, onEvent: (ev: ProcEvent) => void, _onError?: (err: unknown) => void) {
    const p = state.procs.get(id);
    if (!p) {
      setTimeout(() => onEvent({ type: 'exit', code: 1 }), 0);
      return { close: () => {}, write: () => {}, kill: () => {} };
    }
    p.listeners.add(onEvent);
    // Replay what already streamed, like the real bridge's history message.
    if (p.buffer) setTimeout(() => onEvent({ type: 'data', text: p.buffer }), 0);
    return {
      close: () => p.listeners.delete(onEvent),
      write: (text: string) => {
        if (text.includes('\x03')) return interrupt(p);
        const msg = text.replace(/\r$/, '');
        if (msg.trim()) simulateTurn(p, msg);
      },
      kill: () => endProc(p, 0),
    };
  }
}
