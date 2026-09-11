const { db, isPostgres, query, queryOne, financialPeriod, currentFinancialPeriodMonth } = require('../models/database');
const { sendPushNotification, isConfigured } = require('./notificationService');
const { sendDebitReminderEmail } = require('./emailService');

// Check and send debit reminders
async function checkDebitReminders() {
  try {
    console.log('Checking debit reminders...');
    
    // Get current date and time
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Get all users with debit notifications enabled
    const usersSql = isPostgres
      ? `SELECT u.id, u.email, s.debit_reminder_days, s.debit_reminder_hour, s.debit_reminder_minute 
         FROM users u 
         JOIN settings s ON u.id = s.user_id 
         WHERE s.debit_notifications_enabled = 1 
         AND u.status = 'active'`
      : `SELECT u.id, u.email, u.fcm_token, s.debit_reminder_days, s.debit_reminder_hour, s.debit_reminder_minute 
         FROM users u 
         JOIN settings s ON u.id = s.user_id 
         WHERE s.debit_notifications_enabled = 1 
         AND u.status = 'active'`;
    
    const usersResult = await query(usersSql);
    const users = isPostgres ? usersResult.rows : usersResult;
    
    for (const user of users) {
      // Check if current time matches user's reminder time
      if (currentHour === user.debit_reminder_hour && currentMinute === user.debit_reminder_minute) {
        await sendUserDebitReminders(user);
      }
    }
    
    console.log('Debit reminders check completed');
  } catch (error) {
    console.error('Error checking debit reminders:', error);
  }
}

// Send debit reminders for a specific user
async function sendUserDebitReminders(user) {
  try {
    const { id: userId, email, debit_reminder_days } = user;
    const fcm_token = user.fcm_token || null;
    
    // Calculate reminder date
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + debit_reminder_days);
    
    // Get current financial period
    const currentMonth = currentFinancialPeriodMonth();
    const period = financialPeriod(currentMonth);
    
    // Get expenses due on the reminder date
    const expensesSql = isPostgres
      ? `SELECT * FROM expenses 
         WHERE user_id = $1 
         AND debit_date = $2 
         AND paid = 0 
         ORDER BY debit_date`
      : `SELECT * FROM expenses 
         WHERE user_id = ? 
         AND debit_date = ? 
         AND paid = 0 
         ORDER BY debit_date`;
    
    const expensesResult = await query(expensesSql, [userId, reminderDate.toISOString().split('T')[0]]);
    const expenses = isPostgres ? expensesResult.rows : expensesResult;
    
    if (expenses.length === 0) {
      console.log(`No expenses due for user ${userId} on ${reminderDate.toISOString().split('T')[0]}`);
      return;
    }
    
    console.log(`Found ${expenses.length} expenses due for user ${userId} on ${reminderDate.toISOString().split('T')[0]}`);
    
    // Prepare notification content
    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const title = 'Lembrete de Débito';
    const body = `Tens ${expenses.length} despesas no valor de ${totalAmount.toFixed(2)}€ para pagar em ${debit_reminder_days} dia(s).`;
    
    // Send push notification if Firebase is configured and user has token
    if (isConfigured() && fcm_token) {
      const pushResult = await sendPushNotification(fcm_token, {
        title,
        body,
        data: {
          type: 'debit_reminder',
          date: reminderDate.toISOString().split('T')[0],
          count: expenses.length.toString(),
          amount: totalAmount.toString()
        }
      });
      
      if (pushResult.success) {
        console.log(`Push notification sent to user ${userId}`);
      } else {
        console.log(`Failed to send push notification to user ${userId}:`, pushResult.message);
      }
    }
    
    // Send email as fallback
    try {
      await sendDebitReminderEmail(email, expenses, debit_reminder_days);
      console.log(`Email reminder sent to user ${userId}`);
    } catch (emailError) {
      console.error(`Failed to send email reminder to user ${userId}:`, emailError);
    }
    
  } catch (error) {
    console.error(`Error sending debit reminders for user ${user.id}:`, error);
  }
}

// Manual trigger for testing
async function triggerReminderForUser(userId) {
  try {
    // Get user with settings
    const userSql = isPostgres
      ? `SELECT u.id, u.email, s.debit_reminder_days, s.debit_reminder_hour, s.debit_reminder_minute 
         FROM users u 
         JOIN settings s ON u.id = s.user_id 
         WHERE u.id = $1`
      : `SELECT u.id, u.email, u.fcm_token, s.debit_reminder_days, s.debit_reminder_hour, s.debit_reminder_minute 
         FROM users u 
         JOIN settings s ON u.id = s.user_id 
         WHERE u.id = ?`;
    
    const userResult = await queryOne(userSql, [userId]);
    
    if (!userResult) {
      throw new Error('User not found');
    }
    
    await sendUserDebitReminders(userResult);
    return { success: true, message: 'Reminder sent successfully' };
  } catch (error) {
    console.error('Error triggering reminder:', error);
    return { success: false, message: error.message };
  }
}

// Start the reminder scheduler (run every minute)
function startReminderScheduler() {
  console.log('Starting reminder scheduler...');
  
  // Check every minute
  setInterval(checkDebitReminders, 60000);
  
  // Run immediately on start
  checkDebitReminders();
}

module.exports = {
  checkDebitReminders,
  sendUserDebitReminders,
  triggerReminderForUser,
  startReminderScheduler
};
