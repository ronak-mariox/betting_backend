/**
 * Mirrors bettingWeb/src/config/roles.ts (staff hierarchy) plus the 'player'
 * role used by the bettingApp mobile client. Order is top-to-bottom in the
 * hierarchy — index 0 is the root.
 */
const ROLE_ORDER = ['super-admin', 'franchise', 'super-agent', 'agent', 'player'];

/** The one role each role is allowed to create directly underneath itself. */
const CHILD_ROLE = {
  'super-admin': 'franchise',
  franchise: 'super-agent',
  'super-agent': 'agent',
  agent: 'player',
  player: null,
};

/**
 * super-admin is the sole exception to "one level down": it may create any
 * role in the hierarchy (still subject to the parent/child pairing rules
 * enforced in accountService).
 */
const CAN_CREATE_ANY_LEVEL = new Set(['super-admin']);

const roleIndex = (role) => ROLE_ORDER.indexOf(role);

module.exports = {
  ROLE_ORDER,
  CHILD_ROLE,
  CAN_CREATE_ANY_LEVEL,
  roleIndex,
};
