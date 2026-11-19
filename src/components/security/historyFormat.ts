export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

export const errorText = (caught: unknown, fallback: string) =>
  caught instanceof Error && caught.message ? caught.message : fallback;
