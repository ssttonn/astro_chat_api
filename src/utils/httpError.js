class HttpError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode || 500;
    this.errors = errors;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toString() {
    return `${this.name}: ${this.message} (Status Code: ${this.statusCode})`;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errors: this.errors,
    };
  }
}

module.exports = HttpError;
