const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, run, get } = require('../database/db');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Generate unique record ID
function generateRecordId() {
  return 'REC' + Date.now().toString().slice(-8);
}

// Get all medical records (filtered by role)
router.get('/', async (req, res) => {
  try {
    const { patient_id, doctor_id } = req.query;

    let sql = `SELECT 
      mr.*,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.patient_id as patient_code,
      d.first_name as doctor_first_name,
      d.last_name as doctor_last_name,
      d.specialization
    FROM medical_records mr
    LEFT JOIN patients p ON mr.patient_id = p.id
    LEFT JOIN doctors d ON mr.doctor_id = d.id
    WHERE 1=1`;
    const params = [];

    // Customers can only see their own records
    if (req.user.role === 'customer') {
      const user = await get('SELECT patient_id FROM users WHERE id = ?', [req.user.id]);
      if (user && user.patient_id) {
        sql += ' AND mr.patient_id = ?';
        params.push(user.patient_id);
      } else {
        return res.json([]);
      }
    }

    // Doctors can only see records they created
    if (req.user.role === 'doctor') {
      const user = await get('SELECT doctor_id FROM users WHERE id = ?', [req.user.id]);
      if (user && user.doctor_id) {
        sql += ' AND mr.doctor_id = ?';
        params.push(user.doctor_id);
      } else {
        return res.json([]);
      }
    }

    if (patient_id && req.user.role !== 'customer') {
      sql += ' AND mr.patient_id = ?';
      params.push(patient_id);
    }

    if (doctor_id && req.user.role !== 'doctor') {
      sql += ' AND mr.doctor_id = ?';
      params.push(doctor_id);
    }

    sql += ' ORDER BY mr.visit_date DESC, mr.created_at DESC';

    const records = await query(sql, params);
    res.json(records);
  } catch (error) {
    console.error('Get medical records error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get medical record by ID
router.get('/:id', async (req, res) => {
  try {
    const record = await get(
      `SELECT 
        mr.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.patient_id as patient_code,
        p.date_of_birth,
        p.gender,
        p.blood_group,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialization
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN doctors d ON mr.doctor_id = d.id
      WHERE mr.id = ?`,
      [req.params.id]
    );

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }
    res.json(record);
  } catch (error) {
    console.error('Get medical record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create medical record (admin and doctor only)
router.post('/', authorize('admin', 'doctor'), [
  body('patient_id').notEmpty().withMessage('Patient ID is required'),
  body('doctor_id').notEmpty().withMessage('Doctor ID is required'),
  body('visit_date').notEmpty().withMessage('Visit date is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      patient_id, doctor_id, appointment_id,
      diagnosis, symptoms, prescription, test_results, notes, visit_date
    } = req.body;

    // Check if patient exists
    const patient = await get('SELECT * FROM patients WHERE id = ?', [patient_id]);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check if doctor exists
    const doctor = await get('SELECT * FROM doctors WHERE id = ?', [doctor_id]);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const recordId = generateRecordId();
    const result = await run(
      `INSERT INTO medical_records (
        record_id, patient_id, doctor_id, appointment_id,
        diagnosis, symptoms, prescription, test_results, notes, visit_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [recordId, patient_id, doctor_id, appointment_id || null,
       diagnosis, symptoms, prescription, test_results, notes, visit_date]
    );

    const record = await get(
      `SELECT 
        mr.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialization
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN doctors d ON mr.doctor_id = d.id
      WHERE mr.id = ?`,
      [result.id]
    );

    res.status(201).json(record);
  } catch (error) {
    console.error('Create medical record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update medical record (admin and doctor only)
router.put('/:id', authorize('admin', 'doctor'), async (req, res) => {
  try {
    const {
      diagnosis, symptoms, prescription, test_results, notes, visit_date
    } = req.body;

    await run(
      `UPDATE medical_records SET
        diagnosis = ?, symptoms = ?, prescription = ?,
        test_results = ?, notes = ?, visit_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [diagnosis, symptoms, prescription, test_results, notes, visit_date, req.params.id]
    );

    const record = await get(
      `SELECT 
        mr.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialization
      FROM medical_records mr
      LEFT JOIN patients p ON mr.patient_id = p.id
      LEFT JOIN doctors d ON mr.doctor_id = d.id
      WHERE mr.id = ?`,
      [req.params.id]
    );

    res.json(record);
  } catch (error) {
    console.error('Update medical record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete medical record (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await run('DELETE FROM medical_records WHERE id = ?', [req.params.id]);
    res.json({ message: 'Medical record deleted successfully' });
  } catch (error) {
    console.error('Delete medical record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

