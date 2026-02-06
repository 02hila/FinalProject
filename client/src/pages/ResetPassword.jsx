import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token'); // חילוץ הטוקן מה-URL

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            return setStatus({ type: 'error', message: 'הסיסמאות אינן תואמות' });
        }

        if (password.length < 6) {
            return setStatus({ type: 'error', message: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
        }

        setLoading(true);
        try {
            const response = await fetch('https://YOUR-API-URL.com/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: password })
            });

            const data = await response.json();

            if (data.success) {
                setStatus({ type: 'success', message: 'הסיסמה שונתה בהצלחה! מועבר להתחברות...' });
                setTimeout(() => navigate('/login'), 3000);
            } else {
                setStatus({ type: 'error', message: data.message || 'שגיאה בעדכון הסיסמה' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'שגיאה בחיבור לשרת' });
        } finally {
            setLoading(false);
        }
    };

    if (!token) return <div className="text-center mt-10">קישור לא תקין</div>;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 px-6 lg:px-8" dir="rtl">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
                <h2 className="text-center text-3xl font-extrabold text-gray-900">יצירת סיסמה חדשה</h2>
                
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm space-y-4">
                        <input
                            type="password"
                            required
                            placeholder="סיסמה חדשה"
                            className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <input
                            type="password"
                            required
                            placeholder="אימות סיסמה"
                            className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    {status.message && (
                        <div className={`p-3 rounded-lg text-sm text-center ${status.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {status.message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        {loading ? 'מעדכן...' : 'עדכן סיסמה'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;