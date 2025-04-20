const requestLogger = (req, res, next) => {
  console.log("\n=== Request Details ===");
  console.log("Time:", new Date().toISOString());
  console.log("Method:", req.method);
  console.log("Path:", req.path);
  console.log("Query Parameters:", req.query);
  console.log("Request Body:", req.body);
  console.log("Headers:", req.headers);
  console.log("=====================\n");
  next();
};

module.exports = requestLogger;
