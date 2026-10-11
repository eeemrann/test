import type { User } from '../../database/schema.js';

export type AuthenticatedUser = Pick<
  User,
  | 'id'
  | 'fullName'
  | 'email'
  | 'role'
  | 'teamId'
  | 'isActive'
  | 'approvalStatus'
>;

export type LoginUser = Omit<AuthenticatedUser, 'isActive' | 'approvalStatus'>;

export interface AccessTokenPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: 900;
  user: LoginUser;
}

export interface SessionAuthenticationResult extends LoginResponse {
  refreshToken: string;
}
