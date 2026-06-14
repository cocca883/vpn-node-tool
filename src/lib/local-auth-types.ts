export interface LocalUser {
  id: string;
  email: string;
}

export interface LocalSession {
  access_token: string;
  user: LocalUser;
}

export interface LocalAuthResponse {
  data: {
    session: LocalSession | null;
    user: LocalUser | null;
  };
  error: { message: string } | null;
}
