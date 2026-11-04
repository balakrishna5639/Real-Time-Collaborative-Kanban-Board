const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/environment');
const prisma = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token missing or invalid format'
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, error: 'Token has expired' });
      }
      return res.status(401).json({ success: false, error: 'Invalid authentication token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        memberships: {
          include: {
            organization: true,
            tenant: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'User account no longer exists' });
    }

    // Attach user profile and memberships to request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      memberships: user.memberships
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, error: 'Internal authentication error' });
  }
};

module.exports = { authenticate };

