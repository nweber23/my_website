import { LAYERS, formatLatency, simdName } from './layers';

export interface TerminalActions {
  goTo(layer: number): void;
  trace(): void;
  setHitRate(h: number): void;
  setSimd(width: number): void;
  open(anchor: string): void;
  hitRate(): number;
  simd(): number;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A tiny shell that drives the lab. Not a real shell — just enough to be fun. */
export class Terminal {
  private history: string[] = [];
  private cursor = 0;

  constructor(
    private log: HTMLElement,
    input: HTMLInputElement,
    form: HTMLFormElement,
    private act: TerminalActions
  ) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const line = input.value.trim();
      input.value = '';
      if (line) this.run(line);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && this.history.length) {
        this.cursor = Math.max(0, this.cursor - 1);
        input.value = this.history[this.cursor] ?? '';
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        this.cursor = Math.min(this.history.length, this.cursor + 1);
        input.value = this.history[this.cursor] ?? '';
        e.preventDefault();
      } else if (e.key === 'Tab') {
        const done = this.complete(input.value);
        if (done) input.value = done;
        e.preventDefault();
      }
      // Keep the lab's single-key shortcuts from firing while typing.
      e.stopPropagation();
    });
    this.print('<span class="t-dim">nweber@stack — type <b>help</b>, or <b>trace</b> to send a request down.</span>');
  }

  print(html: string) {
    const line = document.createElement('div');
    line.innerHTML = html;
    this.log.appendChild(line);
    while (this.log.childElementCount > 60) this.log.firstElementChild!.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }

  /** Echo a command typed elsewhere (dock buttons) so the log tells the story. */
  echo(cmd: string) {
    this.print(`<span class="t-prompt">$</span> ${esc(cmd)}`);
  }

  private find(arg: string) {
    const a = arg.toLowerCase().replace(/\/$/, '');
    return LAYERS.findIndex(
      (l) => l.key === a || l.code.toLowerCase() === a || l.subject.id === a || l.subject.short.toLowerCase() === a
    );
  }

  private complete(text: string) {
    const [cmd, arg = ''] = text.split(/\s+/);
    const words = arg
      ? LAYERS.flatMap((l) => [l.key, l.subject.id])
      : ['help', 'ls', 'cd', 'cat', 'open', 'trace', 'hitrate', 'simd', 'whoami', 'uname', 'clear'];
    const target = arg || cmd;
    const hit = words.find((w) => w.startsWith(target.toLowerCase()));
    if (!hit) return null;
    return arg ? `${cmd} ${hit}` : hit;
  }

  run(line: string) {
    this.history.push(line);
    this.cursor = this.history.length;
    this.echo(line);
    const [cmd, ...rest] = line.split(/\s+/);
    const arg = rest.join(' ');
    switch (cmd.toLowerCase()) {
      case 'help':
        this.print(
          [
            ['ls', 'list layers and the projects on them'],
            ['cd &lt;layer&gt;', 'descend to a layer (net, os, ram, cache, core)'],
            ['cat &lt;project&gt;', 'print a project summary'],
            ['open &lt;project&gt;', 'jump to the full case study'],
            ['trace', 'send one request down the stack'],
            ['hitrate &lt;50-99&gt;', 'set the cache hit rate'],
            ['simd &lt;1|4|8&gt;', 'set the SIMD width of the core'],
            ['whoami', 'about me'],
          ]
            .map(([c, d]) => `<span class="t-cmd">${c.padEnd(18, ' ')}</span><span class="t-dim">${d}</span>`)
            .join('<br>')
        );
        break;
      case 'ls':
        this.print(
          LAYERS.map(
            (l) =>
              `<span class="t-cmd">${l.key.padEnd(6)}</span><span class="t-dim">${formatLatency(l.latency).padStart(7)}</span>  ${l.subject.id}`
          ).join('<br>')
        );
        break;
      case 'cd': {
        const i = arg ? this.find(arg) : 0;
        if (i < 0) return this.print(`cd: no such layer: ${esc(arg)}`);
        this.act.goTo(i);
        this.print(`<span class="t-dim">→ ${LAYERS[i].name}, ${formatLatency(LAYERS[i].latency)} per access</span>`);
        break;
      }
      case 'cat': {
        const i = this.find(arg);
        if (i < 0) return this.print(`cat: ${esc(arg || '')}: No such file`);
        const s = LAYERS[i].subject;
        this.act.goTo(i);
        this.print(
          `<b>${s.title}</b> — ${s.kind}<br>${esc(s.blurb)}<br><span class="t-dim">${s.metrics.map(([k, v]) => `${k}: ${v}`).join(' · ')}</span>`
        );
        break;
      }
      case 'open': {
        const i = this.find(arg);
        if (i < 0) return this.print(`open: ${esc(arg || '')}: not found`);
        this.act.open(LAYERS[i].subject.anchor);
        break;
      }
      case 'trace':
        this.act.trace();
        break;
      case 'hitrate': {
        const n = Number(arg.replace('%', ''));
        if (!arg) return this.print(`hit rate: ${Math.round(this.act.hitRate() * 100)}%`);
        if (!(n >= 1 && n <= 99)) return this.print('hitrate: expected 1–99');
        this.act.setHitRate(n / 100);
        break;
      }
      case 'simd': {
        const n = Number(arg);
        if (!arg) return this.print(`simd: ${simdName(this.act.simd())}`);
        if (![1, 4, 8].includes(n)) return this.print('simd: expected 1, 4 or 8');
        this.act.setSimd(n);
        this.print(`<span class="t-dim">core now runs ${simdName(n)}</span>`);
        break;
      }
      case 'whoami':
        this.print(
          'Niklas Weber — systems developer at 42 Heilbronn,<br>Software Engineering student at Hochschule Heilbronn.<br><span class="t-dim">C · Go · how things work beneath the abstractions.</span>'
        );
        break;
      case 'uname':
        this.print('nweber 2026.10 x86_64 GNU/Linux <span class="t-dim">(probably)</span>');
        break;
      case 'clear':
        this.log.replaceChildren();
        break;
      case 'sudo':
        this.print('nweber is not in the sudoers file. This incident will be reported.');
        break;
      case 'exit':
        this.print('<span class="t-dim">There is no escape. Try scrolling down instead.</span>');
        break;
      default:
        this.print(`sh: ${esc(cmd)}: command not found <span class="t-dim">— try help</span>`);
    }
  }
}
