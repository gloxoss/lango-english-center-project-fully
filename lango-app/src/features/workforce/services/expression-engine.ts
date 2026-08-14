/**
 * Typed, allowlisted, eval-free payroll expression engine.
 *
 * Values are exact integer minor units (dirham cents). Every formula is a small
 * arithmetic tree over named money variables (component codes / builtins) and
 * integer literals. No `eval()`, no arbitrary function calls, no decimal
 * literals, no string interpolation — the tokenizer only accepts a closed set
 * of tokens and the parser only builds the nodes below.
 *
 * The component resolver passes an environment whose keys are the allowlist:
 * a formula referencing any other variable fails at evaluation time.
 */

export type Money = bigint;

export type FormulaNode =
  | { kind: 'num'; value: Money }
  | { kind: 'var'; name: string }
  | { kind: 'neg'; operand: FormulaNode }
  | { kind: 'bin'; op: '+' | '-' | '*' | '/'; left: FormulaNode; right: FormulaNode }
  | { kind: 'call'; fn: 'min' | 'max' | 'abs' | 'round'; args: FormulaNode[] };

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

type Token =
  | { t: 'num'; v: Money }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: 'lparen' }
  | { t: 'rparen' }
  | { t: 'comma' };

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) { i += 1; continue; }
    if (/[0-9]/.test(ch)) {
      const start = i;
      while (i < src.length && /[0-9]/.test(src[i]!)) { i += 1; }
      tokens.push({ t: 'num', v: BigInt(src.slice(start, i)) });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i]!)) { i += 1; }
      tokens.push({ t: 'id', v: src.slice(start, i) });
      continue;
    }
    if (ch === '(') { tokens.push({ t: 'lparen' }); i += 1; continue; }
    if (ch === ')') { tokens.push({ t: 'rparen' }); i += 1; continue; }
    if (ch === ',') { tokens.push({ t: 'comma' }); i += 1; continue; }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ t: 'op', v: ch }); i += 1; continue;
    }
    throw new FormulaError(`Caractère non autorisé "${ch}" dans la formule.`);
  }
  return tokens;
}

/** Recursive-descent parser. Grammar:
 *  expr     := term (('+'|'-') term)*
 *  term     := factor (('*'|'/') factor)*
 *  factor   := '-' factor | primary
 *  primary  := INT | IDENT | '(' expr ')' | fn '(' expr (',' expr)* ')'
 */
export function parseFormula(source: string): FormulaNode {
  const tokens = tokenize(source);
  let pos = 0;

  function peek(): Token | undefined { return tokens[pos]; }

  function expectOp(op: string): void {
    const tok = tokens[pos];
    if (!tok || tok.t !== 'op' || tok.v !== op) {
      throw new FormulaError(`Opérateur attendu "${op}".`);
    }
    pos += 1;
  }

  function parsePrimary(): FormulaNode {
    const tok = peek();
    if (!tok) throw new FormulaError('Expression incomplète.');
    if (tok.t === 'num') { pos += 1; return { kind: 'num', value: tok.v }; }
    if (tok.t === 'id') {
      pos += 1;
      if (tokens[pos]?.t === 'lparen') {
        const fn = tok.v;
        if (fn !== 'min' && fn !== 'max' && fn !== 'abs' && fn !== 'round') {
          throw new FormulaError(`Fonction non autorisée "${fn}".`);
        }
        pos += 1;
        const args: FormulaNode[] = [];
        if (tokens[pos]?.t === 'rparen') {
          pos += 1;
        } else {
          for (;;) {
            args.push(parseExpr());
            const next = tokens[pos];
            if (next?.t === 'comma') { pos += 1; continue; }
            if (next?.t === 'rparen') { pos += 1; break; }
            throw new FormulaError('Virgule ou parenthèse fermante attendue.');
          }
        }
        if (fn === 'abs' || fn === 'round') {
          if (args.length !== 1) throw new FormulaError(`${fn} attend un seul argument.`);
        } else if (args.length < 2) {
          throw new FormulaError(`${fn} attend au moins deux arguments.`);
        }
        return { kind: 'call', fn, args };
      }
      return { kind: 'var', name: tok.v };
    }
    if (tok.t === 'lparen') {
      pos += 1;
      const node = parseExpr();
      expectOp(')');
      // handled below
      return node;
    }
    throw new FormulaError('Nombre ou variable attendu.');
  }

  function parseFactor(): FormulaNode {
    const tok = peek();
    if (tok && tok.t === 'op' && tok.v === '-') {
      pos += 1;
      return { kind: 'neg', operand: parseFactor() };
    }
    return parsePrimary();
  }

  function parseTerm(): FormulaNode {
    let left = parseFactor();
    for (;;) {
      const tok = peek();
      if (tok && tok.t === 'op' && (tok.v === '*' || tok.v === '/')) {
        pos += 1;
        const right = parseFactor();
        left = { kind: 'bin', op: tok.v as '*' | '/', left, right };
      } else {
        return left;
      }
    }
  }

  function parseExpr(): FormulaNode {
    let left = parseTerm();
    for (;;) {
      const tok = peek();
      if (tok && tok.t === 'op' && (tok.v === '+' || tok.v === '-')) {
        pos += 1;
        const right = parseTerm();
        left = { kind: 'bin', op: tok.v as '+' | '-', left, right };
      } else {
        return left;
      }
    }
  }

  const node = parseExpr();
  if (pos !== tokens.length) {
    throw new FormulaError('Caractères inattendus après la fin de la formule.');
  }
  return node;
}

/** Collect every variable name referenced by a parsed formula — used for
 *  dependency-cycle detection before evaluation. */
export function referencedVariables(node: FormulaNode, into: Set<string> = new Set()): Set<string> {
  switch (node.kind) {
    case 'num': break;
    case 'var': into.add(node.name); break;
    case 'neg': referencedVariables(node.operand, into); break;
    case 'bin': referencedVariables(node.left, into); referencedVariables(node.right, into); break;
    case 'call': node.args.forEach(a => referencedVariables(a, into)); break;
  }
  return into;
}

/** Half-up (or mode-selected) division of money by an exact integer divisor. */
export function divInt(cents: Money, divisor: Money, mode: 'half_up' | 'truncate' | 'floor' | 'ceiling' = 'half_up'): Money {
  if (divisor === 0n) throw new FormulaError('Division par zéro.');
  if (mode === 'truncate') return cents / divisor;
  if (mode === 'floor') {
    const q = cents / divisor;
    return cents < 0n && cents % divisor !== 0n ? q - 1n : q;
  }
  if (mode === 'ceiling') {
    const q = cents / divisor;
    return cents > 0n && cents % divisor !== 0n ? q + 1n : q;
  }
  // half_up: round away from zero on exact .5
  const sign = cents < 0n ? -1n : 1n;
  const abs = cents < 0n ? -cents : cents;
  return sign * ((abs + divisor / 2n) / divisor);
}

/** Multiply money by a basis-point rate (1 bp = 0.01%). result = cents × bp / 10000. */
export function mulBp(cents: Money, bp: Money, mode: 'half_up' | 'truncate' | 'floor' | 'ceiling' = 'half_up'): Money {
  if (bp === 0n) return 0n;
  const sign = cents < 0n ? -1n : 1n;
  const abs = cents < 0n ? -cents : cents;
  const product = abs * bp;
  const rounded = divInt(product, 10000n, mode);
  return sign * rounded;
}

export type FormulaEnv = Record<string, Money>;

export function evaluateFormula(node: FormulaNode, env: FormulaEnv): Money {
  switch (node.kind) {
    case 'num': return node.value;
    case 'var': {
      const v = env[node.name];
      if (v === undefined) throw new FormulaError(`Variable inconnue "${node.name}".`);
      return v;
    }
    case 'neg': return -evaluateFormula(node.operand, env);
    case 'bin': {
      const l = evaluateFormula(node.left, env);
      const r = evaluateFormula(node.right, env);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/': return divInt(l, r);
        default: throw new FormulaError(`Opérateur non autorisé "${node.op}".`);
      }
    }
    case 'call': {
      const args = node.args.map(a => evaluateFormula(a, env));
      switch (node.fn) {
        case 'min': return args.reduce((a, b) => (a < b ? a : b));
        case 'max': return args.reduce((a, b) => (a > b ? a : b));
        case 'abs': return args[0]! < 0n ? -args[0]! : args[0]!;
        case 'round': return args[0]!;
        default: throw new FormulaError(`Fonction non autorisée "${node.fn}".`);
      }
    }
  }
}

/** Parse + validate a formula string. Throws FormulaError on any unsafe input. */
export function compileFormula(source: string): FormulaNode {
  return parseFormula(source);
}
