export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirection responses (3xx)
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client error responses (4xx)
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server error responses (5xx)
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

/*Check if status code indicates success*/

export const isSuccessStatus = (statusCode) => {
  return statusCode >= 200 && statusCode < 300;
};

/* Check if status code indicates client error*/
export const isClientError = (statusCode) => {
  return statusCode >= 400 && statusCode < 500;
};

/* Check if status code indicates server error*/
export const isServerError = (statusCode) => {
  return statusCode >= 500 && statusCode < 600;
};
