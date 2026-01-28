const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://sunamghosh05:sunam923491ghosh@cluster0.lshqheg.mongodb.net/HMS?retryWrites=true&w=majority&appName=Cluster0';

const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB connected successfully');

        // Create default admin if not exists
        const adminEmail = 'admin@hospital.com';
        const adminExists = await User.findOne({ email: adminEmail });

        if (!adminExists) {
            const adminPassword = 'admin123';
            const hashedPassword = await bcrypt.hash(adminPassword, 10);

            const adminUser = new User({
                username: 'Sunam ',
                email: adminEmail,
                password: hashedPassword,
                role: 'admin'
            });

            await adminUser.save();
            console.log('Default admin user created successfully');
            console.log('  Email: admin@hospital.com');
            console.log('  Password: admin123');
        } else {
            console.log('Default admin user already exists');
        }

    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

module.exports = connectDB;
