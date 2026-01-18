import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

// הגדרת API URL נכונה: אין /api בסוף
export const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Version key for localStorage - increment this to invalidate old data
const STORAGE_VERSION = '2';
const STORAGE_VERSION_KEY = 'app_storage_version';

// Debug
console.log("🔧 Environment Mode:", import.meta.env.MODE);
console.log("📝 VITE_API_BASE_URL from .env:", import.meta.env.VITE_API_BASE_URL);
console.log('🌍 Running on:', window.location.hostname);
console.log('🔗 Using API:', API_URL);

// Clear all app-related localStorage data
const clearAppStorage = () => {
    console.log('🧹 Clearing app localStorage data...');
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    localStorage.removeItem('userId');
    localStorage.removeItem('ad_generator_data');
    // Keep the version key
};

// Check and migrate localStorage version
const checkStorageVersion = () => {
    const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    if (storedVersion !== STORAGE_VERSION) {
        console.log(`🔄 Storage version mismatch (${storedVersion} → ${STORAGE_VERSION}), clearing old data...`);
        clearAppStorage();
        localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
        return false;
    }
    return true;
};

// Run version check on module load
checkStorageVersion();

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
                console.log('✅ User and stats loaded:', userObject.fullName);
            } else {
                // Invalid user data from server - clear storage
                clearAppStorage();
            }
        } catch (err) {
            console.error('❌ Error loading user:', err);
            // Clear corrupted/stale localStorage data
            clearAppStorage();
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
        setLoading(true);
        try {
            console.log('🔐 Attempting login...', `${API_URL}/api/auth/login`);

            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            // תמיד קורא את התגובה כ-JSON, גם במקרה של שגיאה
            const data = await res.json();

            // טיפול בשגיאות לפי סטטוס
            if (!res.ok) {
                console.error('❌ Login failed:', res.status, data.message);
                
                // החזרת הודעת השגיאה מהסרבר
                return { 
                    success: false, 
                    message: data.message || 'שגיאה בהתחברות. אנא נסה שנית.' 
                };
            }

            // בדיקה נוספת של success
            if (!data.success) {
                return { 
                    success: false, 
                    message: data.message || 'שגיאה בהתחברות' 
                };
            }

            // התחברות הצליחה
            const userId = data.user._id || data.user.id;
            localStorage.setItem('userId', userId);
            localStorage.setItem('token', data.token);
            localStorage.setItem('userType', data.user.userType);
            
            const userWithToken = { ...data.user, token: data.token };

            setUser(userWithToken);
            setIsInitialized(true);

            const targetPath = getDashboardPath(data.user.userType);
            console.log('🚀 Navigating to:', targetPath);
            navigate(targetPath, { replace: true });

            return { success: true, message: 'התחברת בהצלחה' };

        } catch (err) {
            console.error('❌ Login error:', err);
            
            // הודעת שגיאה ברורה במקרה של בעיית תקשורת
            return { 
                success: false, 
                message: 'בעיית תקשורת עם השרת. אנא בדוק את החיבור לאינטרנט ונסה שוב.' 
            };
        } finally {
            setLoading(false);
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

            //  תמיד קורא את התגובה כ-JSON
            const data = await response.json();

            if (!response.ok) {
                console.error('❌ Registration failed:', response.status, data.message);
                return { 
                    success: false, 
                    message: data.message || 'שגיאה בהרשמה. אנא נסה שנית.' 
                };
            }

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
            return { 
                success: false, 
                message: 'בעיית תקשורת עם השרת. אנא בדוק את החיבור לאינטרנט ונסה שוב.' 
            };
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = useCallback(() => {
        console.log('👋 Logging out...');
        clearAppStorage();
        setUser(null);
        navigate('/login', { replace: true });
    }, [navigate]);

    // Force clear storage and reload - useful for fixing corrupted state
    const forceRefresh = useCallback(() => {
        console.log('🔄 Force refreshing app state...');
        clearAppStorage();
        setUser(null);
        setIsInitialized(false);
        setLoading(true);
        window.location.reload();
    }, []);

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
                forceRefresh,
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