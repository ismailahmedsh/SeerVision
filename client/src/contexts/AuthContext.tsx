
import { createContext, useContext, useState, ReactNode } from "react";
import { login as apiLogin, register as apiRegister } from "../api/auth";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

type AuthContextType = {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem("accessToken");
  });
  const [user, setUser] = useState<User | null>(() => {
    const userData = localStorage.getItem("user");
    return userData ? JSON.parse(userData) : null;
  });

  const login = async (email: string, password: string) => {
    try {
      const response = await apiLogin(email, password);
      if (response?.refreshToken || response?.accessToken) {
        localStorage.setItem("refreshToken", response.refreshToken);
        localStorage.setItem("accessToken", response.accessToken);
        

        if (response.user) {
          localStorage.setItem("user", JSON.stringify(response.user));
          setUser(response.user);
        }
        
        setIsAuthenticated(true);
      } else {
        throw new Error('Login failed');
      }
    } catch (error: any) {
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      setIsAuthenticated(false);
      setUser(null);
      throw new Error(error?.message || 'Login failed');
    }
  };

  const register = async (email: string, password: string) => {
    try {
      const response = await apiRegister(email, password);
    } catch (error: any) {
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("accessToken");
      setIsAuthenticated(false);
      throw new Error(error?.message || 'Registration failed');
    }
  };

  const logout = () => {
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    setUser(null);
    window.location.reload();
  };

  const updateUser = (userData: Partial<User>) => {
    setUser(prevUser => {
      if (!prevUser) return null;
      const updatedUser = { ...prevUser, ...userData };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
