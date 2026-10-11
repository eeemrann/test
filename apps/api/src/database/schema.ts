import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  date,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'EMPLOYEE',
  'MANAGER',
  'ADMIN',
]);

export const approvalStatusEnum = pgEnum('approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const registrationActionEnum = pgEnum('registration_action', [
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
]);

export const attendanceCheckInStatusEnum = pgEnum('attendance_check_in_status', [
  'PRESENT',
  'LATE',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'PENDING',
  'WORKING',
  'DONE',
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'TASK_ASSIGNED',
  'TASK_REASSIGNED',
  'TASK_STATUS_CHANGED',
  'TASK_UPDATED',
]);

export const taskActivityTypeEnum = pgEnum('task_activity_type', [
  'CREATED',
  'ASSIGNED',
  'REASSIGNED',
  'STATUS_CHANGED',
  'UPDATED',
]);

const createdAt = () =>
  timestamp('created_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .notNull();

const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    description: varchar('description', { length: 1000 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('teams_name_unique').on(table.name),
    check('teams_name_not_blank', sql`length(trim(${table.name})) > 0`),
  ],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: userRoleEnum('role').default('EMPLOYEE').notNull(),
    approvalStatus: approvalStatusEnum('approval_status')
      .default('APPROVED')
      .notNull(),
    teamId: uuid('team_id').references(() => teams.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    isActive: boolean('is_active').default(true).notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true, mode: 'date' }),
    attendanceEligibleFrom: timestamp('attendance_eligible_from', {
      withTimezone: true,
      mode: 'date',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    index('users_team_id_idx').on(table.teamId),
    index('users_role_idx').on(table.role),
    check('users_full_name_not_blank', sql`length(trim(${table.fullName})) > 0`),
    check('users_email_not_blank', sql`length(trim(${table.email})) > 0`),
  ],
);

export const registrationAudits = pgTable(
  'registration_audits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    action: registrationActionEnum('action').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('registration_audits_user_id_idx').on(table.userId),
    index('registration_audits_created_at_idx').on(table.createdAt),
  ],
);

export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    attendanceDate: date('attendance_date', { mode: 'string' }).notNull(),
    checkInAt: timestamp('check_in_at', { withTimezone: true, mode: 'date' })
      .notNull(),
    checkOutAt: timestamp('check_out_at', { withTimezone: true, mode: 'date' }),
    checkInStatus: attendanceCheckInStatusEnum('check_in_status').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('attendance_user_date_unique').on(
      table.userId,
      table.attendanceDate,
    ),
    index('attendance_date_idx').on(table.attendanceDate),
    index('attendance_user_date_idx').on(table.userId, table.attendanceDate),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 240 }).notNull(),
    description: varchar('description', { length: 5000 }),
    status: taskStatusEnum('status').default('PENDING').notNull(),
    priority: taskPriorityEnum('priority').default('MEDIUM').notNull(),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    assignedToId: uuid('assigned_to_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    teamId: uuid('team_id').references(() => teams.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    deadline: timestamp('deadline', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'date',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('tasks_status_idx').on(table.status),
    index('tasks_priority_idx').on(table.priority),
    index('tasks_created_by_id_idx').on(table.createdById),
    index('tasks_assigned_to_id_idx').on(table.assignedToId),
    index('tasks_team_id_idx').on(table.teamId),
    index('tasks_deadline_idx').on(table.deadline),
    index('tasks_status_deadline_idx').on(table.status, table.deadline),
    check('tasks_title_not_blank', sql`length(trim(${table.title})) > 0`),
    check(
      'tasks_done_requires_completed_at',
      sql`${table.status} <> 'DONE' OR ${table.completedAt} IS NOT NULL`,
    ),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    taskId: uuid('task_id').references(() => tasks.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    type: notificationTypeEnum('type').notNull(),
    title: varchar('title', { length: 240 }).notNull(),
    message: varchar('message', { length: 2000 }).notNull(),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
    createdAt: createdAt(),
  },
  (table) => [
    index('notifications_recipient_user_id_idx').on(table.recipientUserId),
    index('notifications_recipient_read_at_idx').on(
      table.recipientUserId,
      table.readAt,
    ),
    index('notifications_task_id_idx').on(table.taskId),
  ],
);

export const taskActivities = pgTable(
  'task_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),
    type: taskActivityTypeEnum('type').notNull(),
    metadata: jsonb('metadata'),
    createdAt: createdAt(),
  },
  (table) => [
    index('task_activities_task_created_at_idx').on(
      table.taskId,
      table.createdAt,
    ),
    index('task_activities_actor_user_id_idx').on(table.actorUserId),
  ],
);

export const refreshSessions = pgTable(
  'refresh_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('refresh_sessions_token_hash_unique').on(table.tokenHash),
    index('refresh_sessions_user_id_idx').on(table.userId),
    index('refresh_sessions_expires_at_idx').on(table.expiresAt),
    index('refresh_sessions_user_revoked_idx').on(
      table.userId,
      table.revokedAt,
    ),
    check(
      'refresh_sessions_expiration_after_creation',
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(users),
  tasks: many(tasks),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  team: one(teams, {
    fields: [users.teamId],
    references: [teams.id],
  }),
  createdTasks: many(tasks, { relationName: 'taskCreator' }),
  assignedTasks: many(tasks, { relationName: 'taskAssignee' }),
  notifications: many(notifications),
  taskActivities: many(taskActivities),
  refreshSessions: many(refreshSessions),
  registrationAudits: many(registrationAudits, { relationName: 'registrationUser' }),
  actedRegistrationAudits: many(registrationAudits, { relationName: 'registrationActor' }),
  attendance: many(attendance),
}));

export const registrationAuditsRelations = relations(
  registrationAudits,
  ({ one }) => ({
    user: one(users, {
      fields: [registrationAudits.userId],
      references: [users.id],
      relationName: 'registrationUser',
    }),
    actor: one(users, {
      fields: [registrationAudits.actorUserId],
      references: [users.id],
      relationName: 'registrationActor',
    }),
  }),
);

export const attendanceRelations = relations(attendance, ({ one }) => ({
  user: one(users, {
    fields: [attendance.userId],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ many, one }) => ({
  creator: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
    relationName: 'taskCreator',
  }),
  assignee: one(users, {
    fields: [tasks.assignedToId],
    references: [users.id],
    relationName: 'taskAssignee',
  }),
  team: one(teams, {
    fields: [tasks.teamId],
    references: [teams.id],
  }),
  notifications: many(notifications),
  activities: many(taskActivities),
}));

export const notificationsRelations = relations(
  notifications,
  ({ one }) => ({
    recipient: one(users, {
      fields: [notifications.recipientUserId],
      references: [users.id],
    }),
    task: one(tasks, {
      fields: [notifications.taskId],
      references: [tasks.id],
    }),
  }),
);

export const taskActivitiesRelations = relations(
  taskActivities,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskActivities.taskId],
      references: [tasks.id],
    }),
    actor: one(users, {
      fields: [taskActivities.actorUserId],
      references: [users.id],
    }),
  }),
);

export const refreshSessionsRelations = relations(
  refreshSessions,
  ({ one }) => ({
    user: one(users, {
      fields: [refreshSessions.userId],
      references: [users.id],
    }),
  }),
);

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type RegistrationAudit = typeof registrationAudits.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type NewAttendance = typeof attendance.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type TaskActivity = typeof taskActivities.$inferSelect;
export type NewTaskActivity = typeof taskActivities.$inferInsert;
export type RefreshSession = typeof refreshSessions.$inferSelect;
export type NewRefreshSession = typeof refreshSessions.$inferInsert;
