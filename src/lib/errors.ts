/** Stable error codes for i18n — never put display text here. */

export type ErrorParams = Record<string, string | number>;

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly params?: ErrorParams;

  constructor(code: string, status = 400, params?: ErrorParams) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.params = params;
  }
}

export class ForbiddenError extends AppError {
  constructor(params?: ErrorParams) {
    super("errors.forbidden", 403, params);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(params?: ErrorParams) {
    super("errors.unauthorized", 401, params);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends AppError {
  constructor(params?: ErrorParams) {
    super("errors.not_found", 404, params);
    this.name = "NotFoundError";
  }
}
