import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

// 🔧 הגדרת API URL נכונה: אין /api בסוף
export const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Debug
console.log("🔧 Environment Mode:", import.meta.env.MODE);
console.log("📝 VITE_API_BASE_URL from .env:", import.meta.env.VITE_API_BASE_URL);
console.log('🌍 Running on:', window.location.hostname);
console.log('🔗 Using API:', API_URL);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const navigate = useNavigate();

    const loadUserFromToken = useCallback(async () => {
        const token = localStorage.getItem('token');
        const userId = localStorage.getItem('userId');

        if (!token) {
            setLoading(false);
            setIsInitialized(true);
            return;
        }

        try {
            console.log('🔍 Loading user from token...');
            
            const meResponse = await fetch(`${API_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!meResponse.ok) throw new Error('Failed to fetch user details');

            const meData = await meResponse.json();

            if (meData.success && meData.user) {
                let userObject = meData.user;
                
                userObject.token = token;

                // Agent stats
                if (userId && userObject.userType === 'agent') {
                    try {
                        const statsResponse = await fetch(`${API_URL}/api/agents/${userId}/stats`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (statsResponse.ok) {
                            const statsData = await statsResponse.json();
                            if (statsData.success) {
                                userObject.stats = { ...userObject.stats, ...statsData.stats };
                            }
                        }
                    } catch (statsError) {
                        console.warn('⚠️ Failed to load agent stats:', statsError);
                    }
                }

                // Company ads stats
                if (userId && userObject.userType === 'company' && userObject.company?._id) {
                    try {
                        const historyResponse = await fetch(`${API_URL}/api/companies/${userObject.company._id}/ads/history`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (historyResponse.ok) {
                            const historyData = await historyResponse.json();
                            if (historyData.success && historyData.ads) {
                                const ads = historyData.ads;
                                userObject.stats = {
                                    approved: ads.filter(ad => ad.status === 'approved').length,
                                    pending: ads.filter(ad => ad.status === 'pending').length,
                                    rejected: ads.filter(ad => ad.status === 'rejected').length,
                                    total: ads.length
                                };
                            }
                        }
                    } catch (statsError) {
                        console.warn('⚠️ Failed to load company stats:', statsError);
                    }
                }

                setUser(userObject);
                localStorage.setItem('user', JSON.stringify(userObject));
                console.log('✅ User and stats loaded:', userObject.fullName);

            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('userType');
                localStorage.removeItem('userId');
            }
        } catch (err) {
            console.error('❌ Error loading user:', err);
            localStorage.removeItem('token');
            localStorage.removeItem('userType');
            localStorage.removeItem('userId');
        } finally {
            setLoading(false);
            setIsInitialized(true);
        }
    }, []);

    useEffect(() => {
        if (!isInitialized) {
            loadUserFromToken();
        }
    }, [isInitialized, loadUserFromToken]);

    const getDashboardPath = (userType) => {
        switch (userType) {
            case 'agent':
                return '/agent-dashboard';
            case 'company':
                return '/company-dashboard';
            default:
                return '/dashboard';
        }
    };

    const handleLogin = async (email, password) => {
        try {
            console.log('🔐 Attempting login...', `${API_URL}/api/auth/login`);

            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error('❌ Server error:', errorText);
                return { success: false, message: `שגיאת שרת: ${res.status}` };
            }

            const data = await res.json();
            if (!data.success) {
                return { success: false, message: data.message || 'שגיאה בהתחברות' };
            }

            const userId = data.user._id || data.user.id;
            localStorage.setItem('userId', userId);
            localStorage.setItem('token', data.token);
            localStorage.setItem('userType', data.user.userType);
            
            const userWithToken = { ...data.user, token: data.token };

            setUser(userWithToken);
            localStorage.setItem('user', JSON.stringify(userWithToken)); // ✅ הוסף את זה!
            setIsInitialized(true);

            const targetPath = getDashboardPath(data.user.userType);
            console.log('🚀 Navigating to:', targetPath);
            navigate(targetPath, { replace: true });

            return { success: true, message: 'התחברת בהצלחה' };
        } catch (err) {
            console.error('❌ Login error:', err);
            return { success: false, message: 'שגיאת רשת. אנא נסה שוב מאוחר יותר.' };
        }
    };

    const handleRegister = async (userData) => {
        setLoading(true);
        try {
            console.log('📝 Attempting registration...', `${API_URL}/api/auth/register`);
            console.log('📝 Registration data:', userData);

            const response = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Server error:', errorText);
                return { success: false, message: `שגיאת שרת: ${response.status}` };
            }

            const data = await response.json();
            console.log('📝 Registration response:', data);

            if (data.success) {
                // בדיקה שיש user ו-_id
                if (!data.user || !data.user._id) {
                    console.error('❌ Invalid user data from server:', data);
                    return { success: false, message: 'שגיאה בנתוני השרת - חסר מידע משתמש' };
                }

                const userId = data.user._id;
                localStorage.setItem('userId', userId);
                localStorage.setItem('token', data.token);
                localStorage.setItem('userType', data.user.userType);
                
                const userWithToken = { ...data.user, token: data.token };
                setUser(userWithToken);
                localStorage.setItem('user', JSON.stringify(userWithToken)); // ✅ הוסף את זה!
                setIsInitialized(true);

                const targetPath = getDashboardPath(data.user.userType);
                console.log('🚀 Navigating to:', targetPath);
                navigate(targetPath, { replace: true });

                return { success: true };
            } else {
                return { success: false, message: data.message || 'שגיאה בהרשמה' };
            }
        } catch (error) {
            console.error('❌ Register error:', error);
            return { success: false, message: 'שגיאת רשת - אנא נסה שוב' };
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = useCallback(() => {
        console.log('👋 Logging out...');
        localStorage.removeItem('token');
        localStorage.removeItem('userType');
        localStorage.removeItem('userId');
        localStorage.removeItem('user'); // ✅ הוסף את זה!
        setUser(null);
        navigate('/login', { replace: true });
    }, [navigate]);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                isInitialized,
                handleLogin,
                handleRegister,
                handleLogout,
                loadUserFromToken,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};