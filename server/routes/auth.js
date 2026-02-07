// server/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PendingAd = require('../models/PendingAd');
const { authMiddleware } = require('../middleware/auth');
const { isAdmin } = require('../middleware/adminAuth');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY); 
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, userType, companyName, industry } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'משתמש עם אימייל זה כבר קיים במערכת'
      });
    }

    // Create new user
    const userData = {
      fullName,
      email,
      password, // Encryption will be done in the model's pre-save hook
      userType
    };

    if (userType === 'company') {
      userData.companyName = companyName;
      userData.industry = industry;
    }

    const user = new User(userData);
    await user.save();

    // If the user is a company, set their companyId to their own ID
    if (user.userType === 'company') {
      user.companyId = user._id;
      await user.save();
      console.log('✅ Company registered with companyId:', user.companyId);
    }

    // Create Token
    const token = jwt.sign(
      { userId: user._id, userType: user.userType },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Prepare user object without password
    const userForClient = user.toObject();
    delete userForClient.password;

    res.status(201).json({
      success: true,
      message: 'המשתמש נוצר בהצלחה',
      token,
      user: userForClient  // Returns the full user object
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה ביצירת המשתמש'
    });
  }
});
// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // חיפוש המשתמש במסד הנתונים
        const user = await User.findOne({ email });
        
        // שינוי כאן: אם המשתמש לא נמצא, נחזיר שגיאה ולא נמשיך לשליחת המייל
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'משתמש עם אימייל זה לא נמצא במערכת'
            });
        }

        // יצירת טוקן לשחזור
        const resetToken = jwt.sign(
            { userId: user._id, purpose: 'password-reset' },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '1h' }
        );

        const resetLink = `https://adsmaker-rho.vercel.app/reset-password?token=${resetToken}`;

        // הגדרת הודעת המייל
        const msg = {
            to: email,
            from: { email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com', name: 'AdsMaker' },
            subject: '🔒 שחזור סיסמה - AdsMaker',
            html: `
                <div dir="rtl" style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2 style="color: #667eea;">שחזור סיסמה</h2>
                    <p>שלום ${user.fullName},</p>
                    <p>קיבלנו בקשה לשחזור הסיסמה עבור החשבון שלך.</p>
                    <div style="margin: 30px 0;">
                        <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; font-weight: bold;">לחץ כאן לאיפוס הסיסמה</a>
                    </div>
                    <p style="color: #666; font-size: 12px;">הקישור יהיה בתוקף לשעה אחת בלבד.</p>
                </div>
            `
        };

        // שליחת המייל רק לאחר שווידאנו שהמשתמש קיים
        await sgMail.send(msg);
        console.log(`✅ Reset email sent to: ${email}`);

        res.json({
            success: true,
            message: 'מייל לשחזור סיסמה נשלח בהצלחה'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בתהליך שחזור הסיסמה'
        });
    }
});
// @route   POST /api/auth/reset-password
// @desc    Reset password using token
// @access  Public
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'חלק מהנתונים חסרים'
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: 'הקישור פג תוקף או אינו תקין'
            });
        }

        if (decoded.purpose !== 'password-reset') {
            return res.status(400).json({
                success: false,
                message: 'טוקן לא תקין'
            });
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'המשתמש לא נמצא'
            });
        }

        user.password = newPassword;
        await user.save();

        console.log('✅ Password reset successful for user:', user.email);

        res.json({
            success: true,
            message: 'הסיסמה שונתה בהצלחה, כעת ניתן להתחבר'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בעיבוד הבקשה'
        });
    }
});
// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Trim inputs to handle accidental spaces
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // Find the user
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'אימייל או סיסמה שגויים'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(trimmedPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'אימייל או סיסמה שגויים'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'החשבון שלך אינו פעיל'
      });
    }

    // Create Token
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

// Get user details
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password').lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
    }

    // Add dynamic statistics calculation
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

        // Prevent updating sensitive fields
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

        // Validate input
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

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'משתמש לא נמצא'
            });
        }

        // Check current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'הסיסמה הנוכחית שגויה'
            });
        }

        // Hash new password and save
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

// Create first admin (only if no admin exists yet)
router.post('/create-first-admin', async (req, res) => {
    try {
        const { email, password, fullName, secretKey } = req.body;

        // Secret key for protection!
        const ADMIN_SECRET = process.env.ADMIN_SECRET || 'your-super-secret-key-2024';

        if (secretKey !== ADMIN_SECRET) {
            return res.status(403).json({
                success: false,
                message: 'מפתח סודי שגוי'
            });
        }

        // Check if admin already exists
        const existingAdmin = await User.findOne({ userType: 'admin' });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'כבר קיים מנהל במערכת. השתמש בנתיב אחר להוספת מנהלים.'
            });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'אימייל זה כבר קיים במערכת'
            });
        }

        // Create the admin
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

// Add another admin (only existing admin can)
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

// Get all users (admin only)
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

// Disable/Enable user (admin only)
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

        // Prevent admin from disabling themselves
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

// Delete user (admin only)
router.delete('/delete-user/:userId', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // Prevent admin from deleting themselves
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