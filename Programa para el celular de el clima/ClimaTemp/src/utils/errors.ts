import { ApiError } from '../api/http';

export function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') {
      return 'Sin conexión a internet';
    }
    if (error.kind === 'timeout') {
      return 'El servidor no respondió a tiempo';
    }
  }
  return fallback;
}
