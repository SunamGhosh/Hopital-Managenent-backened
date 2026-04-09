const User = require('../models/User');
const bcrypt = require('bcryptjs');
const Medicine = require('../models/Medicine');

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

        // Seed some sample medicines if none exist
        const medicineCount = await Medicine.countDocuments();
        if (medicineCount === 0) {
            const sampleMedicines = [
                {
                    medicine_id: 'MED1001',
                    name: 'Paracetamol 500mg',
                    category: 'Analgesic',
                    manufacturer: 'GSK',
                    expiry_date: new Date('2025-12-31'),
                    price: 25.50,
                    stock_quantity: 500,
                    status: 'available'
                },
                {
                    medicine_id: 'MED1002',
                    name: 'Amoxicillin 250mg',
                    category: 'Antibiotic',
                    manufacturer: 'Pfizer',
                    expiry_date: new Date('2024-10-15'),
                    price: 120.00,
                    stock_quantity: 200,
                    status: 'available'
                },
                {
                    medicine_id: 'MED1003',
                    name: 'Cetirizine 10mg',
                    category: 'Antihistamine',
                    manufacturer: 'Johnson & Johnson',
                    expiry_date: new Date('2025-06-20'),
                    price: 45.00,
                    stock_quantity: 350,
                    status: 'available'
                }
            ];
            await Medicine.insertMany(sampleMedicines);
            console.log('Sample medicines seeded successfully');
        }
    } catch (error) {
        console.error('Error seeding data:', error);
    }
};

module.exports = seedAdmin;
