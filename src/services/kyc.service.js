const { normalizeMobile } = require('../utils/phone');
const crypto = require('crypto');
const User = require('../models/User');
const KycSubmission = require('../models/KycSubmission');
const ApiError = require('../utils/ApiError');
const notificationService = require('./notification.service');

/** List/summary projection — document images are only loaded where they're shown. */
const WITHOUT_IMAGES = '-front.data -back.data';

/** Max decoded size of one document image (the app promises "Max 5MB"). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const newReferenceId = () => `KYC${crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;

const maskNumber = (value) => (value.length <= 4 ? value : `${'•'.repeat(6)}${value.slice(-4)}`);

/** What the player sees about their own submission: no images, document number masked. */
const toPlayerView = (submission) =>
  submission && {
    referenceId: submission.referenceId,
    status: submission.status,
    rejectionReason: submission.rejectionReason,
    submittedAt: submission.createdAt,
    reviewedAt: submission.reviewedAt,
    documentType: submission.documentType,
    documentNumber: maskNumber(submission.documentNumber),
    files: [submission.front?.name, submission.back?.name].filter(Boolean),
  };

const latestFor = (userId, projection = WITHOUT_IMAGES) =>
  KycSubmission.findOne({ user: userId }).select(projection).sort({ createdAt: -1 });

async function getMine(user) {
  return { kyc: user.kyc, submission: toPlayerView(await latestFor(user._id)) };
}

function toFile(file) {
  if (!file) return null;
  const match = /^data:(image\/(?:png|jpe?g|webp)|application\/pdf);base64,(.+)$/.exec(file.data || '');
  if (!match) throw ApiError.badRequest('Documents must be JPG, PNG, WebP or PDF');
  if (Buffer.byteLength(match[2], 'base64') > MAX_FILE_BYTES) {
    throw ApiError.badRequest('Each document must be 5MB or smaller');
  }
  return { name: (file.name || '').slice(0, 120), mime: match[1], data: file.data };
}

/**
 * Player submits KYC from the app. Allowed while nothing is under review:
 * first time ('Not Submitted') or after a rejection. Moves User.kyc to
 * 'Pending' and alerts staff.
 */
async function submit(user, payload) {
  if (user.kyc === 'Pending') throw ApiError.conflict('Aapka KYC pehle se review mein hai');
  if (user.kyc === 'Verified') throw ApiError.conflict('Aapka KYC already verified hai');

  const submission = await KycSubmission.create({
    user: user._id,
    referenceId: newReferenceId(),
    fullName: payload.fullName,
    phone: payload.phone,
    dob: payload.dob,
    address: payload.address,
    city: payload.city,
    state: payload.state,
    country: payload.country || 'India',
    postalCode: payload.postalCode,
    documentType: payload.documentType,
    documentNumber: payload.documentNumber,
    front: toFile(payload.front),
    back: toFile(payload.back),
  });

  await User.updateOne({ _id: user._id }, { $set: { kyc: 'Pending', ...profileFromKyc(user, submission) } });

  await notificationService.notify({
    title: 'New KYC submission',
    body: `${payload.fullName} (${user.username}) submitted ${payload.documentType} for review`,
    category: 'general',
    emoji: '🪪',
  });

  return { kyc: 'Pending', submission: toPlayerView(submission) };
}

/** Full record for staff (images included), or null if the player never submitted. */
async function getForStaff(userId) {
  return latestFor(userId, '').populate('reviewedBy', 'name username');
}

/**
 * Mirrors a staff KYC decision (made by editing User.kyc) onto the latest
 * submission so the record shows who reviewed it and when.
 */
async function recordReview({ userId, status, reviewer, reason = '' }) {
  if (status !== 'Verified' && status !== 'Rejected') return;
  const submission = await KycSubmission.findOneAndUpdate(
    { user: userId, status: 'Pending' },
    { $set: { status, reviewedBy: reviewer._id, reviewedAt: new Date(), rejectionReason: status === 'Rejected' ? reason : '' } },
    { sort: { createdAt: -1 }, returnDocument: 'after', projection: WITHOUT_IMAGES },
  );
  // Staff can also set the status on an account that never sent documents.
  await notificationService.notifyKycReviewed(
    submission || { _id: `${userId}:${Date.now()}`, user: userId, status, rejectionReason: status === 'Rejected' ? reason : '' },
  );
}

/**
 * App sign-up only asks for a username, so the KYC form is where a player
 * first gives their name, mobile, DOB, city and state. Those fill the account's
 * profile (what the panels list and edit) — only fields still empty, never
 * overwriting what the player or staff already set.
 */

function profileFromKyc(user, submission) {
  const patch = {};
  if (!user.name && submission.fullName) patch.name = submission.fullName;
  if (!user.phone && submission.phone) patch.phone = normalizeMobile(submission.phone) || '';
  if (!user.dob && submission.dob) patch.dob = submission.dob;
  if (!user.city && submission.city) patch.city = submission.city;
  if (!user.state && submission.state) patch.state = submission.state;
  return patch;
}

/** Fills empty profiles of players who submitted KYC before the above existed. Safe to run on every boot. */
async function backfillProfilesFromKyc() {
  const players = await User.find(
    { role: 'player', $or: [{ name: '' }, { phone: '' }, { dob: null }, { city: '' }, { state: '' }] },
    'name phone dob city state',
  ).lean();
  if (!players.length) return;
  const submissions = await KycSubmission.find({ user: { $in: players.map((p) => p._id) } }, 'user fullName phone dob city state')
    .sort({ createdAt: -1 })
    .lean();
  const latest = new Map();
  for (const sub of submissions) if (!latest.has(String(sub.user))) latest.set(String(sub.user), sub);
  for (const player of players) {
    const sub = latest.get(String(player._id));
    const patch = sub && profileFromKyc(player, sub);
    // eslint-disable-next-line no-await-in-loop
    if (patch && Object.keys(patch).length) await User.updateOne({ _id: player._id }, { $set: patch });
  }
}

/**
 * One-time fix for players created before KYC existed: 'Pending' used to be
 * the default for everyone, so a player with no submission really means
 * 'Not Submitted'. Safe to run on every boot.
 */
async function normalizeLegacyStatuses() {
  const submitted = await KycSubmission.distinct('user');
  await User.updateMany({ role: 'player', kyc: 'Pending', _id: { $nin: submitted } }, { $set: { kyc: 'Not Submitted' } });
}

module.exports = { getMine, submit, getForStaff, recordReview, normalizeLegacyStatuses, backfillProfilesFromKyc };
