const User = require('../models/User');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
    try {
        const adminEmail = 'admin@hospital.com';
        const user = await User.findOne({ email: adminEmail });

        if (!user) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                username: 'Sunam ', // Keeping exact username from previous SQLite setup
                email: adminEmail,
                password: hashedPassword,
                role: 'admin'
            });
            console.log('Default admin user created successfully');
        } else {
            console.log('Default admin user already exists');
        }
    } catch (error) {
        console.error('Error seeding admin:', error);
    }
};

module.exports = seedAdmin;
