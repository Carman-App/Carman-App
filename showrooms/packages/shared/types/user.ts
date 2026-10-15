import type { UserRole, UserStatus } from "../constants/roles";

export interface MediaAsset {
  url: string;
  publicId?: string;
}

/** The user shape the API returns. Never contains password or token fields. */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  avatar?: MediaAsset;
  emailVerifiedAt?: string;
  phoneVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  accessTokenExpiresAt: string;
  /** Only returned to native clients (X-Client-Type: mobile). Browsers get an HttpOnly cookie. */
  refreshToken?: string;
}
