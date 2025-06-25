import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      githubId?: number;
      login?: string;
    };
  }

  interface User {
    githubId?: number;
    login?: string;
  }

  interface Profile {
    id?: number;
    login?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    githubId?: number;
    login?: string;
  }
} 