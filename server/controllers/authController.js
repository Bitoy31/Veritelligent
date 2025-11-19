const User = require('../models/User').User;  // Make sure we import the User model correctly
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    try {
        const { userName, userPass } = req.body;
        console.log('Login attempt for username:', userName);
        
        if (!userName || !userPass) {
            console.log('Missing credentials');
            return res.status(400).json({ message: 'Username and password are required' });
        }

        // Find user in users_tbl collection
        const user = await User.findOne({ userName });
        console.log('User found:', user ? 'Yes' : 'No');
        
        if (!user) {
            console.log('User not found');
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        console.log('User role:', user.userRole);
        console.log('Stored password:', user.userPass);
        console.log('Provided password:', userPass);

        // Compare passwords
        const isPasswordValid = userPass === user.userPass;
        console.log('Password valid:', isPasswordValid);

        if (!isPasswordValid) {
            console.log('Invalid password');
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Create JWT token
        const token = jwt.sign(
            { 
                userId: user._id,
                userRole: user.userRole 
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '1h' }
        );

        console.log('Login successful for:', userName, 'Role:', user.userRole);

        // Prepare raw object to defensively read any fields not in schema
        const rawUser = typeof user.toObject === 'function' ? user.toObject() : user;
        const profileFromRaw = (rawUser && (rawUser.userProfile || rawUser.userProfilePic)) || '';
        const profileFromDoc = user.userProfile || user.userProfilePic || '';
        const finalProfile = profileFromDoc || profileFromRaw || '';

        // Send user data and token (include additional profile fields)
        res.json({
            token,
            user: {
                _id: user._id,
                userName: user.userName,
                userFname: user.userFname,
                userMname: user.userMname,
                userLname: user.userLname,
                userRole: user.userRole,
                userEmail: user.userEmail,
                userContact: user.userContact,
                // email verification flags
                emailVerified: Boolean(rawUser?.emailVerified ?? user.emailVerified ?? false),
                emailVerifiedAt: rawUser?.emailVerifiedAt || user.emailVerifiedAt || null,
                // provide both for maximum compatibility
                userProfile: finalProfile,
                userProfilePic: rawUser?.userProfilePic || user.userProfilePic || '',
                userClasses: user.userClasses || []
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

module.exports = { login };