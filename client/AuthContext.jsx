import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const API_URL = 'https://adsmaker.onrender.com/api';

    // בדיקה אם יש משתמש מחובר בטעינת הדף
    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (token && storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (error) {
                console.error('Error parsing user data:', error);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
    }, []);

    // פונקציית התחברות
    const handleLogin = async (email, password) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);

                // ניתוב לפי סוג המשתמש
                if (data.user.userType === 'company') {
                    navigate('/company-dashboard');
                } else if (data.user.userType === 'agent') {
                    navigate('/agent-dashboard');
                } else {
                    navigate('/dashboard');
                }

                return { success: true };
            } else {
                return { success: false, message: data.message || 'שגיאה בהתחברות' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'שגיאת רשת - אנא נסה שוב' };
        } finally {
            setLoading(false);
        }
    };

    // פונקציית הרשמה
    const handleRegister = async (userData) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                setUser(data.user);

                // ניתוב לפי סוג המשתמש
                if (data.user.userType === 'company') {
                    navigate('/company-dashboard');
                } else if (data.user.userType === 'agent') {
                    navigate('/agent-dashboard');
                } else {
                    navigate('/dashboard');
                }

                return { success: true };
            } else {
                return { success: false, message: data.message || 'שגיאה בהרשמה' };
            }
        } catch (error) {
            console.error('Register error:', error);
            return { success: false, message: 'שגיאת רשת - אנא נסה שוב' };
        } finally {
            setLoading(false);
        }
    };

    // פונקציית התנתקות
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        navigate('/login');
    };

    const value = {
        user,
        loading,
        handleLogin,
        handleRegister,
        handleLogout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;