/**
 * PaymentForm.jsx
 *
 * A Stripe-powered payment form that collects card details via the Stripe
 * PaymentElement and processes the payment. After Stripe confirms the payment
 * on the client side, the form sends a server-side confirmation request so the
 * backend can record the completed transaction. This component must be rendered
 * inside a Stripe <Elements> provider that supplies the clientSecret.
 *
 * Props:
 *  - paymentId (string)   The backend payment record ID, used for server confirmation.
 *  - amount    (number)   The payment amount in ILS, displayed on the submit button.
 *  - onSuccess (Function) Callback invoked after a successful payment + server confirmation.
 *  - onCancel  (Function) Callback invoked when the user clicks the cancel button.
 *
 * Used by: PaymentSection component, which wraps this form inside a Stripe <Elements> provider.
 */

import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import './PaymentForm.css';

/**
 * Renders the Stripe payment form and handles the payment submission lifecycle.
 *
 * @param {Object}   props
 * @param {string}   props.paymentId - Backend payment record identifier.
 * @param {number}   props.amount    - Amount to charge (displayed in the button label).
 * @param {Function} props.onSuccess - Called after successful payment and server confirmation.
 * @param {Function} props.onCancel  - Called when the user cancels.
 * @returns {React.ReactElement}
 */
const PaymentForm = ({ paymentId, amount, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  /**
   * Handles form submission: confirms the payment with Stripe and, on success,
   * notifies the backend to mark the payment as completed.
   *
   * @param {React.SyntheticEvent} e - Form submit event.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Stripe.js has not yet loaded; bail early.
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Use 'redirect: if_required' so that the flow stays in-page when possible;
      // Stripe will only redirect for payment methods that require it (e.g. 3D Secure).
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
        // Notify our backend to finalise the payment record.
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
