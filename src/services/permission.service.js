const Permission = require('../models/Permission');
const ApiError = require('../utils/ApiError');
const {
  ROLE_KEYS,
  ROLE_TO_ROLE_KEY,
  PERMISSION_GROUPS,
  PERMISSION_INDEX,
  flatKey: buildFlatKey,
} = require('../constants/permissions');

/** Ensures every role in ROLE_KEYS has a Permission document, seeded from the product defaults. */
async function seedDefaults() {
  await Promise.all(
    ROLE_KEYS.map(async (roleKey) => {
      const exists = await Permission.exists({ roleKey });
      if (exists) return;

      const grants = new Map();
      PERMISSION_GROUPS.forEach((group) => {
        group.permissions.forEach((permission) => {
          grants.set(buildFlatKey(group.key, permission.key), permission.grants[roleKey] || '');
        });
      });
      await Permission.create({ roleKey, grants });
    }),
  );
}

/** The full matrix (groups + names + live grants) for one role key, shaped like permissionsData.ts. */
async function getMatrixForRoleKey(roleKey) {
  if (!ROLE_KEYS.includes(roleKey)) throw ApiError.badRequest('Unknown role key');
  const doc = await Permission.findOne({ roleKey });
  const grants = doc ? doc.grants : new Map();

  return PERMISSION_GROUPS.map((group) => ({
    key: group.key,
    name: group.name,
    permissions: group.permissions.map((permission) => ({
      key: permission.key,
      name: permission.name,
      description: permission.description,
      grant: grants.get(buildFlatKey(group.key, permission.key)) ?? permission.grants[roleKey] ?? '',
    })),
  }));
}

/** Every role's matrix at once, for the Permissions screen's role switcher. */
async function getFullMatrix() {
  const entries = await Promise.all(
    ROLE_KEYS.map(async (roleKey) => [roleKey, await getMatrixForRoleKey(roleKey)]),
  );
  return Object.fromEntries(entries);
}

const GRANT_PATTERN = /^[EVX]{0,3}$/;

/** Replaces the grant for one "group.permission" cell (super-admin only, see permissions.routes). */
async function setGrant({ roleKey, groupKey, permissionKey, grant, updatedBy }) {
  if (!ROLE_KEYS.includes(roleKey)) throw ApiError.badRequest('Unknown role key');
  const key = buildFlatKey(groupKey, permissionKey);
  if (!PERMISSION_INDEX.has(key)) throw ApiError.badRequest('Unknown permission');
  if (typeof grant !== 'string' || !GRANT_PATTERN.test(grant)) {
    throw ApiError.badRequest('grant must be made of only E, V, X');
  }

  const doc = await Permission.findOneAndUpdate(
    { roleKey },
    { $set: { [`grants.${key}`]: grant, updatedBy } },
    { new: true, upsert: true },
  );
  return doc;
}

/**
 * Authorization check used by requirePermission middleware: does `role` hold
 * `action` ('V' or 'X') on `groupKey.permissionKey`? super-admin always
 * passes; unknown roles (e.g. 'player') never do — this matrix only governs
 * the staff panel.
 */
async function hasPermission(role, groupKey, permissionKey, action) {
  if (role === 'super-admin') return true;
  const roleKey = ROLE_TO_ROLE_KEY[role];
  if (!roleKey) return false;

  const key = buildFlatKey(groupKey, permissionKey);
  if (!PERMISSION_INDEX.has(key)) return false;

  const doc = await Permission.findOne({ roleKey });
  const grant = doc?.grants.get(key);
  if (grant === undefined) {
    // Not seeded yet — fall back to the compiled-in default.
    const { permission } = PERMISSION_INDEX.get(key);
    return (permission.grants[roleKey] || '').includes(action);
  }
  return grant.includes('E') && grant.includes(action);
}

module.exports = {
  seedDefaults,
  getMatrixForRoleKey,
  getFullMatrix,
  setGrant,
  hasPermission,
};
