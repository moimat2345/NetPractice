export function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);

  for (const [name, value] of Object.entries(attributes)) {
    if (name === 'className') {
      node.className = value;
    } else if (name.startsWith('on') && typeof value === 'function') {
      node.addEventListener(name.slice(2).toLowerCase(), value);
    } else if (value === true) {
      node.setAttribute(name, '');
    } else if (value !== false && value !== null && value !== undefined) {
      node.setAttribute(name, String(value));
    }
  }

  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

export function replace(node, children = []) {
  node.replaceChildren(...children.flat(Infinity).filter((child) =>
    child !== null && child !== undefined && child !== false));
  return node;
}
