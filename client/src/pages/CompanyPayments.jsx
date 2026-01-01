// pages/CompanyPayments.jsx

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PaymentForm from '../components/PaymentForm';
import SharedHeader from '../components/SharedHeader';
import './CompanyPayments.css';

//  טעינת Stripe עם המפתח הציבורי בלבד
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const CompanyPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const fetchPendingPayments = async () => {
    try {
      const response = await fetch('https://adsmaker.onrender.com/api/payments/pending', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setPayments(data.payments);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('שגיאה בטעינת התשלומים');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayClick = async (payment) => {
    try {
      setSelectedPayment(payment);
      setError(null);

      const response = await fetch(
        `https://adsmaker.onrender.com/api/payments/create-payment-intent/${payment._id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        setClientSecret(data.clientSecret);
      } else {
        setError(data.message);
        setSelectedPayment(null);
      }
    } catch (err) {
      setError('שגיאה ביצירת התשלום');
      setSelectedPayment(null);
    }
  };

  const handlePaymentSuccess = () => {
    setSelectedPayment(null);
    setClientSecret(null);
    fetchPendingPayments();
    alert('התשלום בוצע בהצלחה! 🎉');
  };

  const handlePaymentCancel = () => {
    setSelectedPayment(null);
    setClientSecret(null);
  };

  const formatTimeLeft = (hours) => {
    if (hours === null) return '';
    if (hours <= 0) return '⚠️ עבר הזמן!';
    if (hours < 1) return 'פחות משעה';
    return `${hours} שעות`;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="payments-loading">
        <div className="spinner"></div>
        <p>טוען תשלומים...</p>
      </div>
    );
  }

  return (
    <div className="company-payments-page">
      <SharedHeader 
        userType="company" 
        userName={user.name} 
        onLogout={handleLogout} 
      />

      <div className="payments-container">
        <h1>💳 תשלומים ממתינים</h1>

        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        {payments.length === 0 ? (
          <div className="no-payments">
            <i className="fas fa-check-circle"></i>
            <h3>אין תשלומים ממתינים</h3>
            <p>כל התשלומים שלך מעודכנים!</p>
          </div>
        ) : (
          <div className="payments-list">
            {payments.map((payment) => (
              <div 
                key={payment._id} 
                className={`payment-card ${payment.isOverdue ? 'overdue' : ''}`}
              >
                <div className="payment-header">
                  <h3>{payment.adId?.businessName || 'פרסומת'}</h3>
                  <span className={`time-left ${payment.isOverdue ? 'overdue' : ''}`}>
                    {formatTimeLeft(payment.timeLeftHours)}
                  </span>
                </div>

                {payment.adId?.imageData && (
                  <div className="payment-image">
                    <img src={payment.adId.imageData} alt="תצוגה מקדימה" />
                  </div>
                )}

                <div className="payment-details">
                  <div className="detail-row">
                    <span>סוכן:</span>
                    <span>{payment.agentId?.name || 'לא ידוע'}</span>
                  </div>
                  <div className="detail-row amount">
                    <span>סכום לתשלום:</span>
                    <span className="price">₪{payment.amount}</span>
                  </div>
                </div>

                <button 
                  className="pay-button"
                  onClick={() => handlePayClick(payment)}
                  disabled={selectedPayment?._id === payment._id}
                >
                  {selectedPayment?._id === payment._id ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      מכין תשלום...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-credit-card"></i>
                      שלם עכשיו
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 🔒 מודל תשלום מאובטח */}
        {clientSecret && selectedPayment && (
          <div className="payment-modal-overlay">
            <div className="payment-modal">
              <div className="modal-header">
                <h2>💳 תשלום מאובטח</h2>
                <button className="close-btn" onClick={handlePaymentCancel}>
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="modal-body">
                <div className="payment-summary">
                  <p>תשלום עבור: <strong>{selectedPayment.adId?.businessName}</strong></p>
                  <p className="total-amount">סה"כ: <strong>₪{selectedPayment.amount}</strong></p>
                </div>

                <div className="secure-badge">
                  <i className="fas fa-lock"></i>
                  <span>תשלום מאובטח SSL</span>
                  <img src="/stripe-badge.png" alt="Powered by Stripe" />
                </div>

                <Elements 
                  stripe={stripePromise} 
                  options={{ 
                    clientSecret,
                    appearance: {
                      theme: 'stripe',
                      variables: {
                        colorPrimary: '#3498db',
                      }
                    },
                    locale: 'he'
                  }}
                >
                  <PaymentForm 
                    paymentId={selectedPayment._id}
                    amount={selectedPayment.amount}
                    onSuccess={handlePaymentSuccess}
                    onCancel={handlePaymentCancel}
                  />
                </Elements>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyPayments;