const jwt = require("jsonwebtoken");
const { UnauthenticatedError } = require("../errors");

const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization; // Fix: Define authHeader

  if (!authHeader || !authHeader.startsWith("Bearer")) {
    throw new UnauthenticatedError("Authentication invalid");
  }

  const token = authHeader.split(" ")[1]; // Extract token

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET); // Verify token
    req.user = { name: payload.name, userId: payload.userId }; // Attach user info to request object
    next(); // Proceed to the next middleware
  } catch (e) {
    throw new UnauthenticatedError("Authentication invalid");
  }
};

module.exports = authenticateUser;
