const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query, run, get } = require('../database/db');
const { authenticateToken, authorize } = require('../middleware/auth');

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

    let sql = 'SELECT * FROM doctors WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR doctor_id LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (specialization) {
      sql += ' AND specialization = ?';
      params.push(specialization);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const doctors = await query(sql, params);
    res.json(doctors);
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get doctor by ID
router.get('/:id', async (req, res) => {
  try {
    const doctor = await get('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
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
    const existingUser = await get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const doctorId = generateDoctorId();
    const result = await run(
      `INSERT INTO doctors (
        doctor_id, first_name, last_name, specialization, phone, email,
        qualification, experience_years, consultation_fee,
        available_days, available_time_start, available_time_end, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [doctorId, first_name, last_name, specialization, phone, email,
       qualification, experience_years, consultation_fee,
       available_days, available_time_start, available_time_end, status]
    );

    // Create user account linked to doctor
    await run(
      'INSERT INTO users (username, email, password, role, doctor_id) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, 'doctor', result.id]
    );

    const doctor = await get('SELECT * FROM doctors WHERE id = ?', [result.id]);
    res.status(201).json({ 
      ...doctor, 
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
      const user = await get('SELECT doctor_id FROM users WHERE id = ?', [req.user.id]);
      if (!user || user.doctor_id !== parseInt(req.params.id)) {
        return res.status(403).json({ error: 'You can only update your own profile' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const {
      first_name, last_name, specialization, phone, email,
      qualification, experience_years, consultation_fee,
      available_days, available_time_start, available_time_end, status
    } = req.body;

    await run(
      `UPDATE doctors SET
        first_name = ?, last_name = ?, specialization = ?, phone = ?, email = ?,
        qualification = ?, experience_years = ?, consultation_fee = ?,
        available_days = ?, available_time_start = ?, available_time_end = ?, status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [first_name, last_name, specialization, phone, email,
       qualification, experience_years, consultation_fee,
       available_days, available_time_start, available_time_end, status, req.params.id]
    );

    const doctor = await get('SELECT * FROM doctors WHERE id = ?', [req.params.id]);
    res.json(doctor);
  } catch (error) {
    console.error('Update doctor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete doctor (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await run('DELETE FROM doctors WHERE id = ?', [req.params.id]);
    res.json({ message: 'Doctor deleted successfully' });
  } catch (error) {
    console.error('Delete doctor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specializations
router.get('/specializations/list', async (req, res) => {
  try {
    const result = await query('SELECT DISTINCT specialization FROM doctors ORDER BY specialization');
    const specializations = result.map(r => r.specialization);
    res.json(specializations);
  } catch (error) {
    console.error('Get specializations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

