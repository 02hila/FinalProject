/**
 * paymentReminder.js -- Scheduled Job for Payment Reminders and Overdue Handling
 *
 * Purpose:
 *   Contains the logic for a periodic job (intended to be invoked by a cron
 *   scheduler or similar) that:
 *     1. Finds payments that are past due and still pending, notifies the
 *        agent, marks the associated ad as "overdue", and records the
 *        notification timestamp to avoid duplicate alerts.
 *     2. Finds payments due within the next 2 hours that have not yet
 *        received a "final_reminder", and sends a reminder to the company.
 *
 * Key exports:
 *   - checkOverduePayments() -- the main job function.
 *
 * Connections:
 *   - Reads/writes the Payment model (server/models/Payment).
 *   - Updates PendingAd.paymentStatus to "overdue" for affected ads.
 *   - Queries User model (imported but used indirectly via populate).
 *   - Notification sending is currently stubbed out (TODO comments);
 *     intended to call a notificationService once implemented.
 */

const Payment = require('../models/Payment');
const PendingAd = require('../models/PendingAd');
const User = require('../models/User');
// const notificationService = require('../services/notifications');

/**
 * Checks for overdue and soon-due payments, sending notifications as needed.
 *
 * Overdue logic:
 *   - Finds Payment documents where status is "pending", dueAt is in the past,
 *     and agentNotifiedAt has not been set yet.
 *   - For each, marks agentNotifiedAt and sets the ad's paymentStatus to "overdue".
 *
 * Reminder logic:
 *   - Finds Payment documents due within the next 2 hours that have not
 *     already received a "final_reminder".
 *   - Pushes a reminder entry into the payment's remindersSent array.
 *
 * @returns {Promise<void>}
 */
const checkOverduePayments = async () => {
  console.log('🔍 Checking overdue payments...');

  try {
    const now = new Date();

    // Find payments past their due date that the agent has not been notified about yet
    const overduePayments = await Payment.find({
      status: 'pending',
      dueAt: { $lt: now },
      agentNotifiedAt: { $exists: false }
    }).populate('adId companyId agentId');

    console.log(`Found ${overduePayments.length} overdue payments`);

    for (const payment of overduePayments) {
      console.log(`📧 Notifying agent ${payment.agentId?.email} about overdue payment`);

      // TODO: send real notification once notificationService is implemented
      // await notificationService.notifyAgentOverduePayment(payment);

      // Record the notification timestamp to prevent duplicate alerts
      payment.agentNotifiedAt = new Date();
      await payment.save();

      // Cascade the overdue status to the associated ad
      if (payment.adId) {
        await PendingAd.findByIdAndUpdate(payment.adId, {
          paymentStatus: 'overdue'
        });
      }
    }

    // Look ahead: find payments due within the next 2 hours for a final reminder
    const reminderTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const upcomingPayments = await Payment.find({
      status: 'pending',
      dueAt: { $gt: now, $lt: reminderTime },
      'remindersSent.type': { $ne: 'final_reminder' }
    }).populate('companyId');

    for (const payment of upcomingPayments) {
      console.log(`⏰ Sending reminder to company ${payment.companyId?.email}`);

      // TODO: send real reminder once notificationService is implemented
      // await notificationService.sendPaymentReminder(payment);

      payment.remindersSent.push({
        type: 'final_reminder',
        sentAt: new Date()
      });
      await payment.save();
    }

    console.log('✅ Payment check completed');

  } catch (error) {
    console.error('❌ Error checking payments:', error);
  }
};

module.exports = { checkOverduePayments };
