const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query, run, get } = require('../database/db');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require admin authentication
router.use(authenticateToken);
router.use(authorize('admin'));

// Get all admins
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    
    let sql = `SELECT id, username, email, role, created_at 
               FROM users 
               WHERE role = 'admin'`;
    const params = [];

    if (search) {
      sql += ' AND (username LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    sql += ' ORDER BY created_at DESC';

    const admins = await query(sql, params);
    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin by ID
router.get('/:id', async (req, res) => {
  try {
    const admin = await get(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ? AND role = ?',
      [req.params.id, 'admin']
    );
    
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    res.json(admin);
  } catch (error) {
    console.error('Get admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new admin
router.post('/', [
  body('username').notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const result = await run(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, 'admin']
    );

    const admin = await get(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [result.id]
    );

    res.status(201).json({
      ...admin,
      message: 'Admin created successfully',
      login_email: email,
      login_username: username
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete admin (prevent deleting yourself)
router.delete('/:id', async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const admin = await get('SELECT * FROM users WHERE id = ? AND role = ?', [req.params.id, 'admin']);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    await run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

