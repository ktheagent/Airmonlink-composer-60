'use strict';

function decodeXml(value) {
  return String(value || '').replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    const key = entity.toLowerCase();
    if (key === 'amp') return '&';
    if (key === 'lt') return '<';
    if (key === 'gt') return '>';
    if (key === 'quot') return '"';
    if (key === 'apos') return "'";
    if (key.startsWith('#x')) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith('#')) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return _;
  });
}

function splitSelectors(selector) {
  return String(selector || '').split(',').map(item => item.trim()).filter(Boolean);
}

function tokenizeSelector(selector) {
  const normalized = selector.replace(/\s*>\s*/g, ' > ').trim();
  const raw = normalized.split(/\s+/).filter(Boolean);
  const tokens = [];
  let combinator = null;
  for (const value of raw) {
    if (value === '>') {
      combinator = 'child';
      continue;
    }
    tokens.push({ selector: value, combinator: tokens.length ? (combinator || 'descendant') : null });
    combinator = null;
  }
  return tokens;
}

function parseSimpleSelector(selector) {
  if (selector === ':scope') return { scope: true, tag: null, attribute: null };
  const match = String(selector || '').match(/^([A-Za-z_][\w:.-]*|\*)?(?:\[([A-Za-z_][\w:.-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]+)))?\])?$/);
  if (!match) return { invalid: true };
  return {
    scope: false,
    tag: match[1] && match[1] !== '*' ? match[1].split(':').pop() : null,
    attribute: match[2] ? {
      name: match[2],
      value: match[3] ?? match[4] ?? match[5] ?? null
    } : null
  };
}

function matchesSimple(node, selector, scope) {
  const parsed = parseSimpleSelector(selector);
  if (parsed.invalid) return false;
  if (parsed.scope) return node === scope;
  if (!node || node.nodeType !== 1) return false;
  if (parsed.tag && node.localName !== parsed.tag) return false;
  if (parsed.attribute) {
    if (!node.hasAttribute(parsed.attribute.name)) return false;
    if (parsed.attribute.value !== null && node.getAttribute(parsed.attribute.name) !== parsed.attribute.value) return false;
  }
  return true;
}

function descendants(node) {
  const output = [];
  const visit = current => {
    for (const child of current.children || []) {
      output.push(child);
      visit(child);
    }
  };
  visit(node);
  return output;
}

function evaluateSelector(scope, selector) {
  const tokens = tokenizeSelector(selector);
  if (!tokens.length) return [];
  let current = [];
  const first = tokens[0];
  if (first.selector === ':scope') {
    current = [scope];
  } else {
    const candidates = scope.nodeType === 9
      ? [scope.documentElement, ...descendants(scope.documentElement)].filter(Boolean)
      : [scope, ...descendants(scope)];
    current = candidates.filter(node => matchesSimple(node, first.selector, scope));
  }

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = [];
    for (const node of current) {
      const candidates = token.combinator === 'child'
        ? Array.from(node.children || [])
        : descendants(node);
      for (const candidate of candidates) {
        if (matchesSimple(candidate, token.selector, scope) && !next.includes(candidate)) next.push(candidate);
      }
    }
    current = next;
  }
  return current;
}

class XmlElement {
  constructor(name, attributes = {}) {
    this.nodeType = 1;
    this.tagName = name;
    this.localName = String(name).split(':').pop();
    this.attributes = { ...attributes };
    this.childNodes = [];
    this.parentElement = null;
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  get children() {
    return this.childNodes.filter(node => node && node.nodeType === 1);
  }

  get textContent() {
    return this.childNodes.map(node => node.nodeType === 3 ? node.data : node.textContent).join('');
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }

  matches(selector) {
    return splitSelectors(selector).some(item => matchesSimple(this, item, this));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const output = [];
    for (const item of splitSelectors(selector)) {
      for (const node of evaluateSelector(this, item)) {
        if (!output.includes(node)) output.push(node);
      }
    }
    return output;
  }
}

class XmlText {
  constructor(data) {
    this.nodeType = 3;
    this.data = data;
    this.parentElement = null;
  }

  get textContent() {
    return this.data;
  }
}

class XmlDocument {
  constructor(root = null, parserError = null) {
    this.nodeType = 9;
    this.documentElement = root;
    this.parserError = parserError;
  }

  querySelector(selector) {
    if (selector === 'parsererror') return this.parserError ? new XmlElement('parsererror') : null;
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    if (!this.documentElement) return [];
    const output = [];
    for (const item of splitSelectors(selector)) {
      for (const node of evaluateSelector(this, item)) {
        if (!output.includes(node)) output.push(node);
      }
    }
    return output;
  }
}

function parseAttributes(source) {
  const attributes = {};
  const pattern = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = pattern.exec(source))) {
    attributes[match[1]] = decodeXml(match[2] ?? match[3] ?? '');
  }
  return attributes;
}

class DOMParser {
  parseFromString(source) {
    const xml = String(source || '');
    const doc = new XmlDocument();
    const stack = [];
    const tokenPattern = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[\s\S]*?(?:\[[\s\S]*?\]\s*)?>|<\/[^>]+>|<[^>]+>|[^<]+/gi;
    let match;
    let root = null;
    let error = null;

    try {
      while ((match = tokenPattern.exec(xml))) {
        const token = match[0];
        if (!token) continue;
        if (token.startsWith('<!--') || token.startsWith('<?') || /^<!DOCTYPE/i.test(token)) continue;
        if (token.startsWith('<![CDATA[')) {
          if (stack.length) {
            const textNode = new XmlText(match[1] || '');
            textNode.parentElement = stack.at(-1);
            stack.at(-1).childNodes.push(textNode);
          }
          continue;
        }
        if (token.startsWith('</')) {
          const closing = token.match(/^<\/\s*([A-Za-z_][\w:.-]*)\s*>$/);
          if (!closing || !stack.length || stack.at(-1).tagName !== closing[1]) throw new Error('Mismatched closing tag.');
          stack.pop();
          continue;
        }
        if (token.startsWith('<')) {
          const opening = token.match(/^<\s*([A-Za-z_][\w:.-]*)([\s\S]*?)\/?\s*>$/);
          if (!opening) throw new Error('Malformed opening tag.');
          const selfClosing = /\/\s*>$/.test(token);
          const element = new XmlElement(opening[1], parseAttributes(opening[2] || ''));
          if (stack.length) {
            element.parentElement = stack.at(-1);
            stack.at(-1).childNodes.push(element);
          } else if (!root) {
            root = element;
          } else {
            throw new Error('Multiple document elements.');
          }
          if (!selfClosing) stack.push(element);
          continue;
        }
        if (stack.length) {
          const textNode = new XmlText(decodeXml(token));
          textNode.parentElement = stack.at(-1);
          stack.at(-1).childNodes.push(textNode);
        } else if (token.trim()) {
          throw new Error('Text outside document element.');
        }
      }
      if (!root || stack.length) throw new Error('Malformed XML document.');
    } catch (caught) {
      error = caught;
      root = null;
    }

    doc.documentElement = root;
    doc.parserError = error;
    return doc;
  }
}

module.exports = { DOMParser };
