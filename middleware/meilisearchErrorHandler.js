const { StatusCodes } = require("http-status-codes");

const meilisearchErrorHandler = (err, req, res, next) => {
  // MeiliSearch specific connection errors
  if (
    err.cause &&
    (err.cause.code === "UND_ERR_SOCKET" ||
      (err.message && err.message.includes("has failed")))
  ) {
    console.error("MeiliSearch connection error:", err.message);
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      success: false,
      message:
        "Search service is currently unavailable. Please try again later.",
      error: "SEARCH_SERVICE_UNAVAILABLE",
    });
  }

  // MeiliSearch authentication errors
  if (
    err.cause &&
    (err.cause.code === "missing_authorization_header" ||
      err.cause.code === "invalid_api_key")
  ) {
    console.error("MeiliSearch authentication error:", err.message);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Search service authentication failed. Please contact support.",
      error: "SEARCH_SERVICE_AUTH_ERROR",
    });
  }

  // Pass to next error handler if not a MeiliSearch error
  next(err);
};

module.exports = meilisearchErrorHandler;
