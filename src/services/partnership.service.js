const Partner = require('../models/Partner');
const PartnerSettlement = require('../models/PartnerSettlement');
const ApiError = require('../utils/ApiError');

const listPartners = async () => Partner.find().sort({ createdAt: -1 });

const createPartner = async (data) => Partner.create(data);

const updatePartner = async (id, updates) => {
  const partner = await Partner.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!partner) throw ApiError.notFound('Partner not found');
  return partner;
};

const updatePartnerStatus = async (id, status) => {
  const partner = await Partner.findByIdAndUpdate(id, { status }, { new: true });
  if (!partner) throw ApiError.notFound('Partner not found');
  return partner;
};

const getRevenue = async () => {
  const partners = await Partner.find().select('name revenueHistory betVolume revShare');
  const totalByMonth = {};
  partners.forEach((partner) => {
    partner.revenueHistory.forEach(({ month, value }) => {
      totalByMonth[month] = (totalByMonth[month] || 0) + value;
    });
  });
  return { partners, totalByMonth };
};

const listSettlements = async () => PartnerSettlement.find().populate('partner', 'name type').sort({ createdAt: -1 });

module.exports = { listPartners, createPartner, updatePartner, updatePartnerStatus, getRevenue, listSettlements };
