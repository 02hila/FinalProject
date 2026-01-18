// server/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PendingAd = require('../models/PendingAd');
const { authMiddleware } = require('../middleware/auth');
const { isAdmin } = require('../middleware/adminAuth');

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

    // הכנת אובייקט המשתמש ללא סיסמה
    const userForClient = user.toObject();
    delete userForClient.password;

    res.status(201).json({
      success: true,
      message: 'המשתמש נוצר בהצלחה',
      token,
      user: userForClient  //  מחזיר את כל אובייקט המשתמש
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

    // הוספת חישוב סטטיסטיקות דינמי
    if (user.userType === 'agent') {
        const [approvedAds, pendingAds, rejectedAds] = await Promise.all([
            PendingAd.countDocuments({ agentId: user._id, status: 'approved' }),
            PendingAd.countDocuments({ agentId: user._id, status: 'pending' }),
            PendingAd.countDocuments({ agentId: user._id, status: 'rejected' })
        ]);

        const totalAds = approvedAds + pendingAds + rejectedAds;

        user.stats = {
            ...user.stats,
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
        const userId = req.userId;
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
        const userId = req.userId;
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

        // הצפן את הסיסמה החדשה ושמור
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
// ADMIN ROUTES 

// יצירת admin ראשון (רק אם אין עדיין admin במערכת)
router.post('/create-first-admin', async (req, res) => {
    try {
        const { email, password, fullName, secretKey } = req.body;

        // מפתח סודי להגנה !
        const ADMIN_SECRET = process.env.ADMIN_SECRET || 'your-super-secret-key-2024';
        
        if (secretKey !== ADMIN_SECRET) {
            return res.status(403).json({
                success: false,
                message: 'מפתח סודי שגוי'
            });
        }

        // בדיקה אם כבר יש admin במערכת
        const existingAdmin = await User.findOne({ userType: 'admin' });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'כבר קיים מנהל במערכת. השתמש בנתיב אחר להוספת מנהלים.'
            });
        }

        // בדיקה אם האימייל כבר קיים
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'אימייל זה כבר קיים במערכת'
            });
        }

        // יצירת ה-admin
        const admin = new User({
            email,
            password,
            fullName,
            userType: 'admin',
            isActive: true,
            isVerified: true
        });

        await admin.save();

        console.log('✅ First admin created:', email);

        res.status(201).json({
            success: true,
            message: 'מנהל ראשון נוצר בהצלחה!'
        });

    } catch (error) {
        console.error('❌ Error creating admin:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה ביצירת מנהל'
        });
    }
});

// הוספת admin נוסף (רק admin קיים יכול)
router.post('/create-admin', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { email, password, fullName } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'אימייל זה כבר קיים במערכת'
            });
        }

        const admin = new User({
            email,
            password,
            fullName,
            userType: 'admin',
            isActive: true,
            isVerified: true
        });

        await admin.save();

        console.log('✅ New admin created by:', req.userId);

        res.status(201).json({
            success: true,
            message: 'מנהל חדש נוצר בהצלחה!'
        });

    } catch (error) {
        console.error('❌ Error creating admin:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה ביצירת מנהל'
        });
    }
});

// קבלת כל המשתמשים (admin בלבד)
router.get('/all-users', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { userType, page = 1, limit = 20 } = req.query;
        
        const filter = {};
        if (userType) filter.userType = userType;

        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await User.countDocuments(filter);

        res.json({
            success: true,
            users,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בקבלת משתמשים'
        });
    }
});

// השבתה/הפעלה של משתמש (admin בלבד)
router.put('/toggle-user/:userId', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'משתמש לא נמצא'
            });
        }

        // מניעת השבתת admin את עצמו
        if (user._id.toString() === req.userId) {
            return res.status(400).json({
                success: false,
                message: 'לא ניתן להשבית את עצמך'
            });
        }

        user.isActive = !user.isActive;
        await user.save();

        res.json({
            success: true,
            message: user.isActive ? 'המשתמש הופעל' : 'המשתמש הושבת',
            isActive: user.isActive
        });

    } catch (error) {
        console.error('❌ Error toggling user:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בעדכון משתמש'
        });
    }
});

// מחיקת משתמש (admin בלבד)
router.delete('/delete-user/:userId', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // מניעת מחיקת admin את עצמו
        if (userId === req.userId) {
            return res.status(400).json({
                success: false,
                message: 'לא ניתן למחוק את עצמך'
            });
        }

        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'משתמש לא נמצא'
            });
        }

        console.log('🗑️ User deleted by admin:', userId);

        res.json({
            success: true,
            message: 'המשתמש נמחק בהצלחה'
        });

    } catch (error) {
        console.error('❌ Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה במחיקת משתמש'
        });
    }
});

module.exports = router;