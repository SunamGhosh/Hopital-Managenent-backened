const express = require('express');
const { body, validationResult } = require('express-validator');
const { query, run, get } = require('../database/db');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Generate unique appointment ID
function generateAppointmentId() {
  return 'APT' + Date.now().toString().slice(-8);
}

// Get all appointments (filtered by role)
router.get('/', async (req, res) => {
  try {
    const { date, status, patient_id, doctor_id } = req.query;

    let sql = `SELECT 
      a.*,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.phone as patient_phone,
      d.first_name as doctor_first_name,
      d.last_name as doctor_last_name,
      d.specialization
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    LEFT JOIN doctors d ON a.doctor_id = d.id
    WHERE 1=1`;
    const params = [];

    // Customers can only see their own appointments
    if (req.user.role === 'customer') {
      const user = await get('SELECT patient_id FROM users WHERE id = ?', [req.user.id]);
      if (user && user.patient_id) {
        sql += ' AND a.patient_id = ?';
        params.push(user.patient_id);
      } else {
        return res.json([]);
      }
    }

    // Doctors can only see their own appointments
    if (req.user.role === 'doctor') {
      const user = await get('SELECT doctor_id FROM users WHERE id = ?', [req.user.id]);
      if (user && user.doctor_id) {
        sql += ' AND a.doctor_id = ?';
        params.push(user.doctor_id);
      } else {
        return res.json([]);
      }
    }

    if (date) {
      sql += ' AND a.appointment_date = ?';
      params.push(date);
    }

    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    if (patient_id) {
      sql += ' AND a.patient_id = ?';
      params.push(patient_id);
    }

    if (doctor_id) {
      sql += ' AND a.doctor_id = ?';
      params.push(doctor_id);
    }

    sql += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

    const appointments = await query(sql, params);
    res.json(appointments);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get appointment by ID
router.get('/:id', async (req, res) => {
  try {
    const appointment = await get(
      `SELECT 
        a.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        p.phone as patient_phone,
        p.email as patient_email,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialization,
        d.phone as doctor_phone
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = ?`,
      [req.params.id]
    );

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    res.json(appointment);
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create appointment (admin, doctor, or customer)
router.post('/', [
  body('patient_id').notEmpty().withMessage('Patient ID is required'),
  body('doctor_id').notEmpty().withMessage('Doctor ID is required'),
  body('appointment_date').notEmpty().withMessage('Appointment date is required'),
  body('appointment_time').notEmpty().withMessage('Appointment time is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { patient_id, doctor_id, appointment_date, appointment_time, reason, notes } = req.body;

    // Customers can only book for themselves
    if (req.user.role === 'customer') {
      const user = await get('SELECT patient_id FROM users WHERE id = ?', [req.user.id]);
      if (!user || user.patient_id !== parseInt(patient_id)) {
        return res.status(403).json({ error: 'You can only book appointments for yourself' });
      }
    }

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

    // Check for conflicting appointments
    const conflicting = await get(
      'SELECT * FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != ?',
      [doctor_id, appointment_date, appointment_time, 'cancelled']
    );

    if (conflicting) {
      return res.status(400).json({ error: 'Time slot already booked' });
    }

    const appointmentId = generateAppointmentId();
    const result = await run(
      `INSERT INTO appointments (
        appointment_id, patient_id, doctor_id, appointment_date,
        appointment_time, reason, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [appointmentId, patient_id, doctor_id, appointment_date, appointment_time, reason, notes, 'scheduled']
    );

    const appointment = await get(
      `SELECT 
        a.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = ?`,
      [result.id]
    );

    res.status(201).json(appointment);
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update appointment
router.put('/:id', async (req, res) => {
  try {
    const { appointment_date, appointment_time, status, reason, notes } = req.body;

    await run(
      `UPDATE appointments SET
        appointment_date = ?, appointment_time = ?, status = ?,
        reason = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [appointment_date, appointment_time, status, reason, notes, req.params.id]
    );

    const appointment = await get(
      `SELECT 
        a.*,
        p.first_name as patient_first_name,
        p.last_name as patient_last_name,
        d.first_name as doctor_first_name,
        d.last_name as doctor_last_name,
        d.specialization
      FROM appointments a
      LEFT JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE a.id = ?`,
      [req.params.id]
    );

    res.json(appointment);
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete appointment (admin only, or customer can cancel their own)
router.delete('/:id', async (req, res) => {
  try {
    // Check if customer is trying to cancel their own appointment
    if (req.user.role === 'customer') {
      const appointment = await get('SELECT patient_id FROM appointments WHERE id = ?', [req.params.id]);
      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      const user = await get('SELECT patient_id FROM users WHERE id = ?', [req.user.id]);
      if (!user || user.patient_id !== appointment.patient_id) {
        return res.status(403).json({ error: 'You can only cancel your own appointments' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await run('DELETE FROM appointments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

