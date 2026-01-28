const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorize } = require('../middleware/auth');
const MedicalRecord = require('../models/MedicalRecord');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

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

    let query = {};

    // Customers can only see their own records
    if (req.user.role === 'customer') {
      const user = await User.findById(req.user.id);
      if (user && user.patient_id) {
        query.patient_id = user.patient_id;
      } else {
        return res.json([]);
      }
    }

    // Doctors can only see records they created
    if (req.user.role === 'doctor') {
      const user = await User.findById(req.user.id);
      if (user && user.doctor_id) {
        query.doctor_id = user.doctor_id;
      } else {
        return res.json([]);
      }
    }

    if (patient_id && req.user.role !== 'customer') {
      query.patient_id = patient_id;
    }

    if (doctor_id && req.user.role !== 'doctor') {
      query.doctor_id = doctor_id;
    }

    const records = await MedicalRecord.find(query)
      .populate('patient_id', 'first_name last_name patient_id')
      .populate('doctor_id', 'first_name last_name specialization')
      .sort({ visit_date: -1, created_at: -1 });

    res.json(records);
  } catch (error) {
    console.error('Get medical records error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get medical record by ID
router.get('/:id', async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id)
      .populate('patient_id', 'first_name last_name patient_id date_of_birth gender blood_group')
      .populate('doctor_id', 'first_name last_name specialization');

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
    const patient = await Patient.findById(patient_id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check if doctor exists
    const doctor = await Doctor.findById(doctor_id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const recordId = generateRecordId();

    // Check appointment if provided
    if (appointment_id) {
      const appointment = await Appointment.findById(appointment_id);
      if (!appointment) {
        // Optional: Fail or just ignore and set null
      }
    }

    const record = await MedicalRecord.create({
      record_id: recordId,
      patient_id, doctor_id, appointment_id: appointment_id || null,
      diagnosis, symptoms, prescription, test_results, notes, visit_date
    });

    const populatedRecord = await MedicalRecord.findById(record._id)
      .populate('patient_id', 'first_name last_name')
      .populate('doctor_id', 'first_name last_name specialization');

    res.status(201).json(populatedRecord);
  } catch (error) {
    console.error('Create medical record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update medical record (admin and doctor only)
router.put('/:id', authorize('admin', 'doctor'), async (req, res) => {
  try {
    const updates = req.body;
    updates.updated_at = Date.now();
    delete updates._id;
    delete updates.record_id;
    delete updates.patient_id;
    delete updates.doctor_id;

    const record = await MedicalRecord.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('patient_id', 'first_name last_name')
      .populate('doctor_id', 'first_name last_name specialization');

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    res.json(record);
  } catch (error) {
    console.error('Update medical record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete medical record (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const record = await MedicalRecord.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }
    res.json({ message: 'Medical record deleted successfully' });
  } catch (error) {
    console.error('Delete medical record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
