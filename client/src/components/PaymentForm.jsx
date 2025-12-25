// components/PaymentForm.jsx

import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import './PaymentForm.css';

const PaymentForm = ({ paymentId, amount, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
        redirect: 'if_required'
      });

      if (error) {
        setErrorMessage(error.message);
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // אישור בשרת שלנו
        await fetch(`https://adsmaker.onrender.com/api/payments/confirm/${paymentId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ paymentIntentId: paymentIntent.id })
        });

        onSuccess();
      }

    } catch (err) {
      setErrorMessage('שגיאה בעיבוד התשלום');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <PaymentElement 
        options={{
          layout: 'tabs'
        }}
      />

      {errorMessage && (
        <div className="payment-error">
          <i className="fas fa-exclamation-triangle"></i>
          {errorMessage}
        </div>
      )}

      <div className="payment-actions">
        <button 
          type="button" 
          className="cancel-btn"
          onClick={onCancel}
          disabled={isProcessing}
        >
          ביטול
        </button>
        
        <button 
          type="submit" 
          className="submit-btn"
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              מעבד...
            </>
          ) : (
            <>
              <i className="fas fa-lock"></i>
              שלם ₪{amount}
            </>
          )}
        </button>
      </div>

      <p className="security-note">
        <i className="fas fa-shield-alt"></i>
        פרטי הכרטיס שלך מוגנים ולא נשמרים בשרתים שלנו
      </p>
    </form>
  );
};

export default PaymentForm;