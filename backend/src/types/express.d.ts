declare global {
  namespace Express {
    interface User {
      id: number;
      googleId: string;
      email: string;
      name: string | null;
      picture: string | null;
    }
  }
}

export {};
