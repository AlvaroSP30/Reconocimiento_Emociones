import { createContext } from 'react';
import type {AuthContextType} from "../types.ts";


export const AuthContext = createContext<AuthContextType | null>(null);