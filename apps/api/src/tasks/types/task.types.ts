import type {
  Task,
  TaskActivity,
  Team,
  User,
} from '../../database/schema.js';

export type PublicTaskUser = Pick<
  User,
  'id' | 'fullName' | 'email' | 'role' | 'teamId'
>;

export type PublicTaskTeam = Pick<Team, 'id' | 'name'>;

export interface TaskResponse
  extends Pick<
    Task,
    | 'id'
    | 'title'
    | 'description'
    | 'status'
    | 'priority'
    | 'deadline'
    | 'completedAt'
    | 'createdAt'
    | 'updatedAt'
    | 'teamId'
  > {
  creator: PublicTaskUser;
  assignee: PublicTaskUser;
  team: PublicTaskTeam | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface AssignableUserResponse {
  id: string;
  fullName: string;
  email: string;
  teamId: string | null;
}

export interface TaskActivityResponse {
  id: string;
  type: TaskActivity['type'];
  createdAt: Date;
  actor: PublicTaskUser;
  metadata: Record<string, unknown> | null;
}

export interface TaskSummaryResponse {
  total: number;
  pending: number;
  working: number;
  done: number;
  overdue: number;
}
