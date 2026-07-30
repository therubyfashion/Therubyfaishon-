export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface DatabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: Record<string, any>;
}

export function handleDatabaseError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);

  const errInfo: DatabaseErrorInfo = {
    error: errorMessage,
    authInfo: {},
    operationType,
    path
  };
  console.error('Database Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
