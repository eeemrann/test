export const notificationQueryKeys = {
  all: (userId: string) => ['notifications', userId] as const,
  list: (userId: string, unreadOnly: boolean, limit: number) => ['notifications', userId, 'list', { unreadOnly, limit }] as const,
  unreadCount: (userId: string) => ['notifications', userId, 'unread-count'] as const,
}
