const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, run, get } = require('../database/db');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Generate unique patient ID
function generatePatientId() {
  return 'PAT' + Date.now().toString().slice(-8);
}

// Get all patients (admin and doctor only, or customer's own record)
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM patients WHERE 1=1';
    const params = [];

    // Customers can only see their own record
    if (req.user.role === 'customer') {
      const user = await get('SELECT patient_id FROM users WHERE id = ?', [req.user.id]);
      if (user && user.patient_id) {
        sql += ' AND id = ?';
        params.push(user.patient_id);
      } else {
        return res.json({ patients: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } });
      }
    }

    if (search && req.user.role !== 'customer') {
      sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR patient_id LIKE ? OR phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const patients = await query(sql, params);
    const total = await get('SELECT COUNT(*) as count FROM patients' + (req.user.role === 'customer' ? ' WHERE id = ?' : ''), req.user.role === 'customer' ? [params[0]] : []);

    res.json({
      patients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total.count,
        pages: Math.ceil(total.count / limit)
      }
    });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get patient by ID
router.get('/:id', async (req, res) => {
  try {
    const patient = await get('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(patient);
  } catch (error) {
    console.error('Get patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create patient (admin only)
router.post('/', authorize('admin'), [
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

    const patientId = generatePatientId();
    const {
      first_name, last_name, date_of_birth, gender,
      phone, email, address, emergency_contact_name,
      emergency_contact_phone, blood_group, allergies
    } = req.body;

    const result = await run(
      `INSERT INTO patients (
        patient_id, first_name, last_name, date_of_birth, gender,
        phone, email, address, emergency_contact_name,
        emergency_contact_phone, blood_group, allergies
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patientId, first_name, last_name, date_of_birth, gender,
       phone, email, address, emergency_contact_name,
       emergency_contact_phone, blood_group, allergies]
    );

    const patient = await get('SELECT * FROM patients WHERE id = ?', [result.id]);
    res.status(201).json(patient);
  } catch (error) {
    console.error('Create patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update patient (admin, doctor, or customer's own record)
router.put('/:id', async (req, res) => {
  try {
    // Check if customer is trying to update their own record
    if (req.user.role === 'customer') {
      const user = await get('SELECT patient_id FROM users WHERE id = ?', [req.user.id]);
      if (!user || user.patient_id !== parseInt(req.params.id)) {
        return res.status(403).json({ error: 'You can only update your own record' });
      }
    }

    const {
      first_name, last_name, date_of_birth, gender,
      phone, email, address, emergency_contact_name,
      emergency_contact_phone, blood_group, allergies
    } = req.body;

    await run(
      `UPDATE patients SET
        first_name = ?, last_name = ?, date_of_birth = ?, gender = ?,
        phone = ?, email = ?, address = ?, emergency_contact_name = ?,
        emergency_contact_phone = ?, blood_group = ?, allergies = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [first_name, last_name, date_of_birth, gender,
       phone, email, address, emergency_contact_name,
       emergency_contact_phone, blood_group, allergies, req.params.id]
    );

    const patient = await get('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    res.json(patient);
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete patient (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await run('DELETE FROM patients WHERE id = ?', [req.params.id]);
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

