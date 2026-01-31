import { JwtPayload } from '../services/auth.service';

declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string | null;
      role: string;
    }
    
    interface Request {
      user?: User;
    }
  }
}

export {};
