const { cleanIp } = require('../utils/ip');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const accountService = require('../services/account.service');
const tokenService = require('../services/token.service');
const permissionService = require('../services/permission.service');
const auditService = require('../services/audit.service');
const notificationService = require('../services/notification.service');
const { verifyPassword, hashPassword } = require('../services/password.service');
const { ROLE_TO_ROLE_KEY } = require('../constants/permissions');

const requestMeta = (req) => ({ userAgent: req.headers['user-agent'] || '', ip: cleanIp(req.ip) });

/** Shapes the login/refresh/me payload: the public user plus their (possibly empty) permission matrix. */
const buildSession = async (user) => {
  const roleKey = ROLE_TO_ROLE_KEY[user.role];
  const permissions = roleKey ? await permissionService.getMatrixForRoleKey(roleKey) : null;
  return { user: user.toJSON(), permissions };
};

const register = asyncHandler(async (req, res) => {
  const { username, password, referralCode } = req.body;
  const user = await accountService.registerPlayer({ username, password, referralCode });

  // Signing up signs the player in, so it counts as their first login.
  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user, requestMeta(req));

  await auditService.record({ actor: user, action: 'register', target: user, req });
  await notificationService.notifyWelcome({ user });

  res.status(201).json({ ...(await buildSession(user)), accessToken, refreshToken });
});

const login = asyncHandler(async (req, res) => {
  const { username, password, roleId } = req.body;
  const normalizedUsername = username.trim().toLowerCase();

  const user = await User.findOne({ username: normalizedUsername }).select('+passwordHash');
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !valid) {
    await auditService.record({
      action: 'login_failed',
      status: 'failed',
      req,
      metadata: { username: normalizedUsername },
    });
    throw ApiError.unauthorized('Invalid username or password');
  }

  if (user.status !== 'active') {
    await auditService.record({ actor: user, action: 'login_failed', status: 'failed', req, target: user });
    throw ApiError.forbidden('This account has been suspended');
  }

  if (roleId && roleId !== user.role) {
    await auditService.record({ actor: user, action: 'login_failed', status: 'failed', req, target: user });
    throw ApiError.unauthorized('These credentials are not valid for the selected panel');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user, requestMeta(req));

  await auditService.record({ actor: user, action: 'login_success', target: user, req });
  await notificationService.notifyLogin({ user, userAgent: requestMeta(req).userAgent });

  res.json({ ...(await buildSession(user)), accessToken, refreshToken });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const { user, refreshToken: nextRefreshToken } = await tokenService.rotateRefreshToken(
    refreshToken,
    requestMeta(req),
  );
  const accessToken = tokenService.signAccessToken(user);
  res.json({ accessToken, refreshToken: nextRefreshToken });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await tokenService.revokeRefreshToken(refreshToken);
  if (req.user) await auditService.record({ actor: req.user, action: 'logout', req });
  res.status(204).send();
});

const me = asyncHandler(async (req, res) => {
  res.json(await buildSession(req.user));
});

const PROFILE_FIELDS = ['name', 'email', 'phone', 'city', 'state', 'dob', 'avatar', 'preferences'];

/** Self-service profile edit (Edit Profile screen) — only the fields actually present in the body change. */
const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  PROFILE_FIELDS.forEach(field => {
    if (req.body[field] === undefined) return;
    if (field === 'preferences') {
      // Switches are saved one screen at a time, so the ones not sent keep their value.
      Object.entries(req.body.preferences).forEach(([key, value]) => user.preferences.set(key, value));
      return;
    }
    user[field] = req.body[field];
  });

  await user.save();
  await auditService.record({ actor: user, action: 'profile_updated', target: user, req });

  res.json(await buildSession(user));
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.badRequest('Current password is incorrect');

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();

  // Every other session (and this one's now-stale access token) is invalidated.
  await tokenService.revokeAllForUser(user._id);
  const accessToken = tokenService.signAccessToken(user);
  const refreshToken = await tokenService.issueRefreshToken(user, requestMeta(req));

  await auditService.record({ actor: user, action: 'password_changed', target: user, req });
  await notificationService.notifyPasswordChanged({ user });

  res.json({ accessToken, refreshToken });
});

const listSessions = asyncHandler(async (req, res) => {
  const sessions = await RefreshToken.find({ user: req.user._id, revokedAt: null })
    .sort({ createdAt: -1 })
    .select('-tokenHash -replacedByHash');
  res.json({ sessions });
});

const revokeSession = asyncHandler(async (req, res) => {
  const session = await RefreshToken.findById(req.params.id);
  if (!session) throw ApiError.notFound('Session not found');

  const isOwn = String(session.user) === String(req.user._id);
  if (!isOwn && req.user.role !== 'super-admin') {
    throw ApiError.forbidden('You can only revoke your own sessions');
  }

  session.revokedAt = new Date();
  await session.save();

  await auditService.record({
    actor: req.user,
    action: 'session_revoked',
    target: session.user,
    req,
    metadata: { sessionId: session._id },
  });

  res.status(204).send();
});

const auditLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 25);

  const [items, total] = await Promise.all([
    AuditLog.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', 'username role name')
      .populate('target', 'username role name'),
    AuditLog.countDocuments(),
  ]);

  res.json({ items, total, page, limit });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  updateMe,
  changePassword,
  listSessions,
  revokeSession,
  auditLogs,
};
