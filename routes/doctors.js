const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorize } = require('../middleware/auth');
const Doctor = require('../models/Doctor');
const User = require('../models/User');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Generate unique doctor ID
function generateDoctorId() {
  return 'DOC' + Date.now().toString().slice(-8);
}

// Get all doctors
router.get('/', async (req, res) => {
  try {
    const { search, specialization, status } = req.query;

    let query = {};

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { first_name: regex },
        { last_name: regex },
        { doctor_id: regex }
      ];
    }

    if (specialization) {
      query.specialization = specialization;
    }

    if (status) {
      query.status = status;
    }

    const doctors = await Doctor.find(query).sort({ created_at: -1 });
    res.json(doctors);
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get doctor by ID
router.get('/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    res.json(doctor);
  } catch (error) {
    console.error('Get doctor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create doctor (admin only)
router.post('/', authorize('admin'), [
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
  body('specialization').notEmpty().withMessage('Specialization is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('username').notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      first_name, last_name, specialization, phone, email,
      qualification, experience_years, consultation_fee,
      available_days, available_time_start, available_time_end, status = 'active',
      username, password
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const doctorCode = generateDoctorId();

    const doctor = await Doctor.create({
      doctor_id: doctorCode,
      first_name, last_name, specialization, phone, email,
      qualification, experience_years, consultation_fee,
      available_days, available_time_start, available_time_end, status
    });

    // Create user account linked to doctor
    await User.create({
      username,
      email,
      password: hashedPassword,
      role: 'doctor',
      doctor_id: doctor._id
    });

    res.status(201).json({
      ...doctor.toObject(),
      message: 'Doctor created successfully. Login credentials have been set.',
      login_email: email,
      login_username: username
    });
  } catch (error) {
    console.error('Create doctor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update doctor (admin only, or doctor can update own profile)
router.put('/:id', async (req, res) => {
  try {
    // Check if doctor is trying to update their own profile
    if (req.user.role === 'doctor') {
      const user = await User.findById(req.user.id);
      if (!user || !user.doctor_id || user.doctor_id.toString() !== req.params.id) {
        return res.status(403).json({ error: 'You can only update your own profile' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const updates = req.body;
    updates.updated_at = Date.now();
    delete updates._id;
    delete updates.doctor_id; // prevent ID change

    const doctor = await Doctor.findByIdAndUpdate(req.params.id, updates, { new: true });

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    res.json(doctor);
  } catch (error) {
    console.error('Update doctor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete doctor (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const doctor = await Doctor.findByIdAndDelete(req.params.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    // Ideally delete linked user too
    await User.findOneAndDelete({ doctor_id: doctor._id });

    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    console.error('Delete doctor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specializations
router.get('/specializations/list', async (req, res) => {
  try {
    const specializations = await Doctor.distinct('specialization');
    res.json(specializations.sort());
  } catch (error) {
    console.error('Get specializations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
