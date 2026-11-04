const prisma = require('../config/database');

const getActivityLogs = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const limit = Math.min(Number(req.query.limit) || 30, 100);

    const logs = await prisma.activityLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    const parsed = logs.map((log) => {
      let detailsObj = {};
      try {
        detailsObj = JSON.parse(log.details);
      } catch (e) {
        detailsObj = { text: log.details };
      }
      return {
        ...log,
        details: detailsObj
      };
    });

    return res.json({ success: true, activities: parsed });
  } catch (error) {
    console.error('getActivityLogs error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve activity logs' });
  }
};

module.exports = { getActivityLogs };

