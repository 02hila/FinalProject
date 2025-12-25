// jobs/paymentReminder.js

const Payment = require('../models/Payment');
const Ad = require('../models/Ad');
const User = require('../models/User');
// const notificationService = require('../services/notifications');

const checkOverduePayments = async () => {
  console.log('🔍 Checking overdue payments...');
  
  try {
    const now = new Date();
    
    // מצא תשלומים שעבר זמנם ועדיין pending
    const overduePayments = await Payment.find({
      status: 'pending',
      dueAt: { $lt: now },
      agentNotifiedAt: { $exists: false } // עדיין לא הודענו לסוכן
    }).populate('adId companyId agentId');
    
    console.log(`Found ${overduePayments.length} overdue payments`);
    
    for (const payment of overduePayments) {
      // שליחת התראה לסוכן
      console.log(`📧 Notifying agent ${payment.agentId?.email} about overdue payment`);
      
      // TODO: שליחת התראה אמיתית
      // await notificationService.notifyAgentOverduePayment(payment);
      
      // סימון שהודענו לסוכן
      payment.agentNotifiedAt = new Date();
      await payment.save();
      
      // עדכון סטטוס הפרסומת
      if (payment.adId) {
        await Ad.findByIdAndUpdate(payment.adId, {
          paymentStatus: 'overdue'
        });
      }
    }
    
    // שליחת תזכורת לפני שעבר הזמן (שעתיים לפני)
    const reminderTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    const upcomingPayments = await Payment.find({
      status: 'pending',
      dueAt: { $gt: now, $lt: reminderTime },
      'remindersSent.type': { $ne: 'final_reminder' }
    }).populate('companyId');
    
    for (const payment of upcomingPayments) {
      console.log(`⏰ Sending reminder to company ${payment.companyId?.email}`);
      
      // TODO: שליחת תזכורת
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