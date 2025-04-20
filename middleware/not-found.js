const notFoundMiddleware = (req, res, next) => {
  res.status(404).json({ msg: "Route does not exist" });
};

module.exports = notFoundMiddleware;
