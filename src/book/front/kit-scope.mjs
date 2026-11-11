// The kit's stylesheet, kept to the book.
//
// src/book/kit/paper.css is shared and is not edited. The front draws inside its
// own tree, so it reads the kit's rules as text and puts each one under the
// front's root class, the same way the front's own rules are written. Both sets
// of rules gain the same weight, so they still win and lose against each other
// exactly as they do in the kit's own examples.

/** Split "a, b:is(c, d)" at the commas that are not inside brackets. */
function selectorsIn(list) {
  const out = [];
  let depth = 0, from = 0;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] === '(' || list[i] === '[') depth += 1;
    else if (list[i] === ')' || list[i] === ']') depth -= 1;
    else if (list[i] === ',' && depth === 0) { out.push(list.slice(from, i)); from = i + 1; }
  }
  out.push(list.slice(from));
  return out.map((selector) => selector.trim()).filter(Boolean);
}

/**
 * Put every rule of a stylesheet under one root class.
 * :root, html and body become the root itself. @keyframes, @property and
 * @font-face are left as they are; rules inside @media and the like are scoped.
 * @param {string} css
 * @param {string} [root]   the class to scope under
 * @returns {string}
 */
export function scopeKit(css, root = '.book-front') {
  const walk = (source) => {
    let out = '', at = 0;
    while (at < source.length) {
      const open = source.indexOf('{', at);
      if (open < 0) { out += source.slice(at); break; }
      let depth = 0, close = open;
      for (; close < source.length; close += 1) {
        if (source[close] === '{') depth += 1;
        else if (source[close] === '}' && (depth -= 1) === 0) break;
      }
      const prelude = source.slice(at, open).trim();
      const body = source.slice(open + 1, close);
      if (/^@(?:media|supports|container|layer)\b/.test(prelude)) out += `${prelude}{${walk(body)}}\n`;
      else if (prelude.startsWith('@')) out += `${prelude}{${body}}\n`;
      else out += `${selectorsIn(prelude).map((selector) => (/^(?::root|html|body)$/.test(selector) ? root : `${root} ${selector}`)).join(',')}{${body}}\n`;
      at = close + 1;
    }
    return out;
  };
  return walk(css.replace(/\/\*[\s\S]*?\*\//g, ''));
}
