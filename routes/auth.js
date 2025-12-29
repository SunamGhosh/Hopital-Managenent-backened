const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { get, run } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register (for customers/patients)
router.post('/register', [
  body('username').notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('first_name').notEmpty().withMessage('First name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
  body('date_of_birth').notEmpty().withMessage('Date of birth is required'),
  body('gender').notEmpty().withMessage('Gender is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, first_name, last_name, date_of_birth, gender, phone, address } = req.body;

    // Check if user exists
    const existingUser = await get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate patient ID
    const patientId = 'PAT' + Date.now().toString().slice(-8);

    // Create patient record first
    const patientResult = await run(
      `INSERT INTO patients (
        patient_id, first_name, last_name, date_of_birth, gender,
        phone, email, address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [patientId, first_name, last_name, date_of_birth, gender, phone, email, address]
    );

    // Insert user linked to patient
    await run(
      'INSERT INTO users (username, email, password, role, patient_id) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, 'customer', patientResult.id]
    );

    res.status(201).json({ message: 'Registration successful. Please login.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user with linked data
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await get(
      `SELECT u.id, u.username, u.email, u.role, u.patient_id, u.doctor_id,
              p.patient_id as patient_code, p.first_name as patient_first_name, p.last_name as patient_last_name,
              d.doctor_id as doctor_code, d.first_name as doctor_first_name, d.last_name as doctor_last_name
       FROM users u
       LEFT JOIN patients p ON u.patient_id = p.id
       LEFT JOIN doctors d ON u.doctor_id = d.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

