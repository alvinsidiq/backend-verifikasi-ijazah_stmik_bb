// src/middlewares/roleMiddleware.js

function roleMiddleware(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthenticated',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {// src/middlewares/roleMiddleware.js

function roleMiddleware(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthenticated',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: insufficient role',
      });
    }

    next();
  };
}

module.exports = roleMiddleware;

      return res.status(403).json({
        success: false,
        message: 'Forbidden: insufficient role',
      });
    }

    next();
  };
}

module.exports = roleMiddleware;
