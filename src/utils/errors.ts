export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isDuplicateCommandError(error: unknown): boolean {
  if (!error) return false;
  const anyErr = error as Record<string, unknown>;
  const msg = typeof anyErr.message === 'string' ? anyErr.message : '';
  const respData = (anyErr.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
  const errorCode = String(anyErr.errorCode || respData?.errorCode || respData?.code || '');
  const serverMsg = typeof respData?.message === 'string' ? respData.message : '';

  return (
    errorCode === 'COMMAND_IN_PROGRESS_DUPLICATE_REJECTED' ||
    msg.includes('COMMAND_IN_PROGRESS_DUPLICATE_REJECTED') ||
    serverMsg.includes('COMMAND_IN_PROGRESS_DUPLICATE_REJECTED') ||
    msg.toLowerCase().includes('đang thực thi lệnh trước') ||
    serverMsg.toLowerCase().includes('đang thực thi lệnh trước')
  );
}
