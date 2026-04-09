const mongoose = require('mongoose');
const Medicine = require('./models/Medicine');
const dotenv = require('dotenv');

dotenv.config();

const checkDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    const count = await Medicine.countDocuments();
    console.log('Medicine count:', count);
    const medicines = await Medicine.find();
    console.log('Medicines:', JSON.stringify(medicines, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkDB();
