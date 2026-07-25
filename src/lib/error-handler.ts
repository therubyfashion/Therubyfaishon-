export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: Record<string, any>;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (typeof window !== 'undefined') {
    const lowerMsg = errorMessage.toLowerCase();
    if (
      lowerMsg.includes('quota exceeded') ||
      lowerMsg.includes('quota-exceeded') ||
      lowerMsg.includes('resource-exhausted') ||
      (error as any)?.code === 'resource-exhausted' ||
      errorMessage.includes('Free daily read units per project')
    ) {
      window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
    }
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {},
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
