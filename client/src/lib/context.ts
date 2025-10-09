import { createContext } from "react";
import { User } from "firebase/auth";

interface UserContextType {
  user: User | null;
}

export const UserContext = createContext<UserContextType>({ user: null });
