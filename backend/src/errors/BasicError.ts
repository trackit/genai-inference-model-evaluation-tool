export enum BasicErrorType {
  BAD_REQUEST = 'BAD_REQUEST',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export class BasicError extends Error {
  constructor(
    public readonly type: BasicErrorType,
    public readonly code: string,
    message: string,
    public readonly description?: string,
  ) {
    super(message);
    this.name = 'BasicError';
  }
}
