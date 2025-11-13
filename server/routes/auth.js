// server/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PendingAd = require('../models/PendingAd'); // ✅ Import the missing model
const { authMiddleware } = require('../middleware/auth');

// הרשמה
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, userType, companyName, industry } = req.body;

    // בדיקה אם המשתמש כבר קיים
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'משתמש עם אימייל זה כבר קיים במערכת' 
      });
    }

    // יצירת משתמש חדש
    const userData = {
      fullName,
      email,
      password, // ההצפנה תתבצע ב-pre-save hook של המודל
      userType
    };

    if (userType === 'company') {
      userData.companyName = companyName;
      userData.industry = industry;
    }

    const user = new User(userData);
    await user.save();

    // אם המשתמש הוא חברה, הגדר את ה-companyId שלו להיות ה-ID של עצמו
    if (user.userType === 'company') {
      user.companyId = user._id;
      await user.save();
      console.log('✅ Company registered with companyId:', user.companyId);
    }

    // יצירת Token
    const token = jwt.sign(
      { userId: user._id, userType: user.userType },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'המשתמש נוצר בהצלחה',
      token,
      userId: user._id,
      userType: user.userType,
      fullName: user.fullName
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'שגיאה ביצירת המשתמש' 
    });
  }
});

// התחברות
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // חיפוש המשתמש
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'אימייל או סיסמה שגויים' 
      });
    }

    // בדיקת סיסמה
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'אימייל או סיסמה שגויים' 
      });
    }

    // בדיקה אם המשתמש פעיל
    if (!user.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'החשבון שלך אינו פעיל' 
      });
    }

    // יצירת Token
    const token = jwt.sign(
      { userId: user._id, userType: user.userType },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    const userForClient = user.toObject();
    delete userForClient.password;

    res.json({
      success: true,
      message: 'התחברת בהצלחה',
      token,
      user: userForClient
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'שגיאה בהתחברות' 
    });
  }
});

// קבלת פרטי משתמש
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password').lean(); 
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'משתמש לא נמצא' 
      });
    }

    // ==================================================
    // ✅ הוספת חישוב סטטיסטיקות דינמי
    // ==================================================
    if (user.userType === 'agent') {
        const [approvedAds, pendingAds, rejectedAds] = await Promise.all([
            PendingAd.countDocuments({ agentId: user._id, status: 'approved' }),
            PendingAd.countDocuments({ agentId: user._id, status: 'pending' }),
            PendingAd.countDocuments({ agentId: user._id, status: 'rejected' })
        ]);

        const totalAds = approvedAds + pendingAds + rejectedAds;

        // הוסף את הסטטיסטיקות לאובייקט המשתמש
        // ודא שאובייקט ה-stats קיים
        user.stats = {
            ...user.stats, // שמור על סטטיסטיקות קיימות כמו דירוג
            approvedAds,
            pendingAds,
            rejectedAds,
            totalAds
        };
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'שגיאה בקבלת פרטי משתמש' 
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId; // מגיע מה-authMiddleware
        const updates = req.body;

        console.log('📝 Updating profile for user:', userId);

        // מניעת עדכון שדות רגישים
        delete updates.password;
        delete updates.email;
        delete updates.userType;
        delete updates.stats;

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ success: false, error: 'משתמש לא נמצא' });
        }

        console.log('✅ Profile updated successfully');

        res.json({
            success: true,
            message: 'הפרופיל עודכן בהצלחה',
            user
        });

    } catch (error) {
        console.error('❌ Error updating profile:', error);
        res.status(500).json({ success: false, error: 'שגיאה בעדכון הפרופיל' });
    }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId; // מגיע מה-authMiddleware
        const { currentPassword, newPassword } = req.body;

        console.log('🔐 Changing password for user:', userId);

        // בדיקת קלט
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'נא למלא את כל השדות'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'הסיסמה חייבת להכיל לפחות 6 תווים'
            });
        }

        // מצא את המשתמש
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'משתמש לא נמצא'
            });
        }

        // בדוק את הסיסמה הנוכחית
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'הסיסמה הנוכחית שגויה'
            });
        }

        // הצפן את הסיסמה החדשה ושמור (ה-hook ב-User model יטפל בזה)
        user.password = newPassword;
        await user.save();

        console.log('✅ Password changed successfully');

        res.json({
            success: true,
            message: 'הסיסמה שונתה בהצלחה'
        });

    } catch (error) {
        console.error('❌ Error changing password:', error);
        res.status(500).json({ success: false, error: 'שגיאה בשינוי הסיסמה' });
    }
});

module.exports = router;