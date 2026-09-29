const User = require('../models/User');

/**
 * The whole account tree as a lightweight in-memory index (id -> role/parent,
 * parent -> children). Loaded once per request so subtree math is cheap.
 */
async function loadTree() {
  const rows = await User.find({}, '_id parent role').lean();
  const byId = new Map();
  const children = new Map();
  for (const row of rows) {
    const id = String(row._id);
    byId.set(id, { id, role: row.role, parent: row.parent ? String(row.parent) : null });
    if (row.parent) {
      const key = String(row.parent);
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(id);
    }
  }
  return { byId, children };
}

/** Every descendant id of `rootId` (not including the root). */
function descendants(tree, rootId) {
  const out = [];
  const stack = [...(tree.children.get(String(rootId)) || [])];
  const seen = new Set();
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    stack.push(...(tree.children.get(id) || []));
  }
  return out;
}

module.exports = { loadTree, descendants };
