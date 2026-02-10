/**
 * PaymentSection.jsx
 *
 * Displays a list of pending payments for a company user and handles the full
 * Stripe payment flow. On mount it fetches all pending payments from the backend.
 * When the user clicks "Pay Now", a Stripe PaymentIntent is created server-side,
 * the returned clientSecret is used to initialise the Stripe Elements provider,
 * and the PaymentForm component collects card details. After successful payment
 * the list is refreshed automatically.
 *
 * Props:
 *  - highlightedPaymentId (string) Optional. If provided, the matching payment
 *    card is visually highlighted and a banner is shown indicating a new payment
 *    request from an agent.
 *
 * Used by: CompanyDashboard, typically rendered inside the "payments" tab.
 *
 * Notable behaviour:
 *  - Stripe is loaded lazily via loadStripe with the publishable key from env.
 *  - Each payment card shows remaining time until the payment deadline (dueAt).
 */
import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PaymentForm from './PaymentForm';
import { getPendingPayments, createPaymentIntent } from '../services/companyService';


// Initialise the Stripe instance once at module level to avoid re-creating on every render.
// Allow Stripe analytics for proper functionality
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_XXXXXXX');

/**
 * Renders the pending payments list and orchestrates the Stripe checkout flow.
 *
 * @param {Object} props
 * @param {string} [props.highlightedPaymentId] - ID of a payment to visually emphasise.
 * @returns {React.ReactElement}
 */
const PaymentSection = ({ highlightedPaymentId }) => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [clientSecret, setClientSecret] = useState(null);
    const [processingPaymentId, setProcessingPaymentId] = useState(null);
    const [error, setError] = useState(null);

    /** Fetch pending payments on initial mount. */
    useEffect(() => {
        fetchPayments();
    }, []);

    /**
     * Fetches the list of pending payments from the backend service.
     */
    const fetchPayments = async () => {
        setLoading(true);
        try {
            const data = await getPendingPayments();
            if (data.success) {
                setPayments(data.payments || []);
            } else {
                setError(data.error || 'שגיאה בטעינת תשלומים');
            }
        } catch (err) {
            setError('שגיאה בטעינת תשלומים');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Initiates the payment process by requesting a PaymentIntent from the
     * backend. On success, stores the clientSecret and shows the Stripe form.
     *
     * @param {Object} payment - The payment record to process.
     */
    const handleStartPayment = async (payment) => {
        setProcessingPaymentId(payment._id);
        setError(null);

        try {
            const data = await createPaymentIntent(payment._id);

            if (data.success && data.clientSecret) {
                setClientSecret(data.clientSecret);
                setSelectedPayment(payment);
            } else {
                setError(data.error || 'שגיאה ביצירת תשלום');
            }
        } catch (err) {
            setError('שגיאה ביצירת תשלום');
            console.error(err);
        } finally {
            setProcessingPaymentId(null);
        }
    };

    /** Called after a successful Stripe payment; resets the form and refreshes the list. */
    const handlePaymentSuccess = () => {
        setSelectedPayment(null);
        setClientSecret(null);
        fetchPayments();
        alert('✅ התשלום בוצע בהצלחה! תודה רבה.');
    };

    /** Cancels the current payment flow and returns to the list view. */
    const handleCancelPayment = () => {
        setSelectedPayment(null);
        setClientSecret(null);
    };

    /**
     * Computes the human-readable time remaining until the payment deadline.
     *
     * @param {Object} payment - Payment record with an optional dueAt field.
     * @returns {{ text: string, isOverdue: boolean }|null} Formatted time or null if no deadline.
     */
    const formatTimeLeft = (payment) => {
        if (!payment.dueAt) return null;

        const now = new Date();
        const due = new Date(payment.dueAt);
        const diff = due - now;

        if (diff <= 0) return { text: 'פג תוקף!', isOverdue: true };

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return { text: `${hours} שעות ו-${minutes} דקות`, isOverdue: false };
        }
        return { text: `${minutes} דקות`, isOverdue: false };
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <div style={{ fontSize: '40px', marginBottom: '15px' }}>⏳</div>
                <p>טוען תשלומים...</p>
            </div>
        );
    }

    // Stripe checkout view -- shown when a payment has been selected and clientSecret is ready.
    if (selectedPayment && clientSecret) {
        return (
            <div style={{
                background: 'white',
                borderRadius: '15px',
                padding: '30px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                maxWidth: '500px',
                margin: '0 auto'
            }}>
                <h2 style={{
                    textAlign: 'center',
                    marginBottom: '25px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    💳 תשלום מאובטח
                </h2>

                <div style={{
                    background: '#f8f9fa',
                    padding: '20px',
                    borderRadius: '10px',
                    marginBottom: '25px',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#666', marginBottom: '5px' }}>סכום לתשלום</div>
                    <div style={{
                        fontSize: '36px',
                        fontWeight: 'bold',
                        color: '#2e7d32'
                    }}>
                        ₪{selectedPayment.amount?.toLocaleString()}
                    </div>
                </div>

                <div style={{
                    background: '#fff3e0',
                    borderRight: '4px solid #ff9800',
                    padding: '15px',
                    borderRadius: '8px',
                    marginBottom: '25px'
                }}>
                    <strong>👤 סוכן:</strong> {selectedPayment.agentId?.name || selectedPayment.agentId?.fullName || 'לא ידוע'}<br/>
                    <strong>📢 פרסומת:</strong> {selectedPayment.adId?.businessName || selectedPayment.adId?.title || 'פרסומת'}
                </div>

                {/* Stripe Elements provider injects the clientSecret into PaymentForm */}
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <PaymentForm
                        paymentId={selectedPayment._id}
                        amount={selectedPayment.amount}
                        onSuccess={handlePaymentSuccess}
                        onCancel={handleCancelPayment}
                    />
                </Elements>

                <div style={{
                    marginTop: '20px',
                    padding: '15px',
                    background: '#e8f5e9',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontSize: '13px',
                    color: '#2e7d32'
                }}>
                    🔒 התשלום מאובטח ומוצפן על ידי Stripe<br/>
                    פרטי הכרטיס שלך לא נשמרים בשרתים שלנו
                </div>
            </div>
        );
    }

    return (
        <div>
            <h2 style={{
                fontSize: '24px',
                marginBottom: '25px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }}>
                <span>💳</span>
                <span>תשלומים ממתינים ({payments.length})</span>
            </h2>

            {error && (
                <div style={{
                    background: '#ffebee',
                    color: '#c62828',
                    padding: '15px',
                    borderRadius: '10px',
                    marginBottom: '20px',
                    textAlign: 'center'
                }}>
                    ❌ {error}
                </div>
            )}

            {highlightedPaymentId && (
                <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    textAlign: 'center'
                }}>
                    <h3 style={{ margin: '0 0 10px 0' }}>💰 בקשת תשלום חדשה!</h3>
                    <p style={{ margin: 0, opacity: 0.9 }}>
                        סוכן טוען שהעלה את הפרסומת שלכם. אנא בדקו ואשרו את התשלום.
                    </p>
                </div>
            )}

            {payments.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '50px',
                    background: '#f8f9fa',
                    borderRadius: '15px'
                }}>
                    <div style={{ fontSize: '50px', marginBottom: '15px' }}>✅</div>
                    <p style={{ fontSize: '18px', color: '#666' }}>אין תשלומים ממתינים</p>
                    <p style={{ color: '#999' }}>כל התשלומים הושלמו בהצלחה</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {payments.map(payment => {
                        const timeLeft = formatTimeLeft(payment);
                        const isHighlighted = payment._id === highlightedPaymentId;

                        return (
                            <div
                                key={payment._id}
                                style={{
                                    background: 'white',
                                    borderRadius: '15px',
                                    padding: '25px',
                                    boxShadow: isHighlighted
                                        ? '0 0 0 3px #667eea, 0 4px 20px rgba(102, 126, 234, 0.3)'
                                        : '0 4px 15px rgba(0,0,0,0.08)',
                                    transition: 'all 0.3s'
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '20px',
                                    flexWrap: 'wrap',
                                    gap: '15px'
                                }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>
                                            📢 {payment.adId?.businessName || payment.adId?.title || 'פרסומת'}
                                        </h3>
                                        <p style={{ margin: 0, color: '#7f8c8d' }}>
                                            <strong>סוכן:</strong> {payment.agentId?.name || payment.agentId?.fullName || 'לא ידוע'}
                                        </p>
                                        <p style={{ margin: '5px 0 0 0', color: '#7f8c8d', fontSize: '14px' }}>
                                            <strong>תאריך:</strong> {new Date(payment.createdAt).toLocaleDateString('he-IL')}
                                        </p>
                                    </div>

                                    {timeLeft && (
                                        <div style={{
                                            padding: '8px 16px',
                                            background: timeLeft.isOverdue ? '#ffebee' : '#fff3e0',
                                            color: timeLeft.isOverdue ? '#c62828' : '#e65100',
                                            borderRadius: '20px',
                                            fontSize: '14px',
                                            fontWeight: '600'
                                        }}>
                                            ⏰ {timeLeft.text}
                                        </div>
                                    )}
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '20px',
                                    marginBottom: '20px'
                                }}>
                                    <div style={{
                                        background: '#f8f9fa',
                                        padding: '20px',
                                        borderRadius: '10px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ color: '#666', fontSize: '14px', marginBottom: '5px' }}>
                                            סכום לתשלום
                                        </div>
                                        <div style={{
                                            fontSize: '28px',
                                            fontWeight: 'bold',
                                            color: '#2e7d32'
                                        }}>
                                            ₪{payment.amount?.toLocaleString()}
                                        </div>
                                    </div>

                                    <div style={{
                                        background: '#f8f9fa',
                                        padding: '20px',
                                        borderRadius: '10px',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ color: '#666', fontSize: '14px', marginBottom: '5px' }}>
                                            סטטוס
                                        </div>
                                        <div style={{
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                            color: '#ff9800'
                                        }}>
                                            ⏳ ממתין לתשלום
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleStartPayment(payment)}
                                    disabled={processingPaymentId === payment._id}
                                    style={{
                                        width: '100%',
                                        padding: '15px 30px',
                                        background: processingPaymentId === payment._id
                                            ? '#ccc'
                                            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '30px',
                                        fontSize: '18px',
                                        fontWeight: 'bold',
                                        cursor: processingPaymentId === payment._id ? 'wait' : 'pointer',
                                        transition: 'all 0.3s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    {processingPaymentId === payment._id ? (
                                        <>
                                            <span className="spinner"></span>
                                            מעבד...
                                        </>
                                    ) : (
                                        <>
                                            💳 שלם עכשיו
                                        </>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                .spinner {
                    width: 20px;
                    height: 20px;
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default PaymentSection;
