const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorize } = require('../middleware/auth');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');

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

    let query = {};

    // Customers can only see their own appointments
    if (req.user.role === 'customer') {
      const user = await User.findById(req.user.id);
      if (user && user.patient_id) {
        query.patient_id = user.patient_id;
      } else {
        return res.json([]);
      }
    }

    // Doctors can only see their own appointments
    if (req.user.role === 'doctor') {
      const user = await User.findById(req.user.id);
      if (user && user.doctor_id) {
        query.doctor_id = user.doctor_id;
      } else {
        return res.json([]);
      }
    }

    if (date) {
      query.appointment_date = date;
    }

    if (status) {
      query.status = status;
    }

    // Allow filtering by patient_id/doctor_id only if not restricted by role
    if (patient_id && req.user.role !== 'customer') {
      query.patient_id = patient_id;
    }

    if (doctor_id && req.user.role !== 'doctor') {
      query.doctor_id = doctor_id;
    }

    const appointments = await Appointment.find(query)
      .populate('patient_id', 'first_name last_name phone email patient_id')
      .populate('doctor_id', 'first_name last_name specialization doctor_id')
      .sort({ appointment_date: -1, appointment_time: -1 });

    res.json(appointments);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get appointment by ID
router.get('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patient_id', 'first_name last_name phone email')
      .populate('doctor_id', 'first_name last_name specialization');

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
      const user = await User.findById(req.user.id);
      if (!user || !user.patient_id || user.patient_id.toString() !== patient_id) {
        return res.status(403).json({ error: 'You can only book appointments for yourself' });
      }
    }

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

    // Check for conflicting appointments
    const conflicting = await Appointment.findOne({
      doctor_id,
      appointment_date,
      appointment_time,
      status: { $ne: 'cancelled' }
    });

    if (conflicting) {
      return res.status(400).json({ error: 'Time slot already booked' });
    }

    const appointmentId = generateAppointmentId();

    const appointment = await Appointment.create({
      appointment_id: appointmentId,
      patient_id,
      doctor_id,
      appointment_date,
      appointment_time,
      reason,
      notes,
      status: 'scheduled'
    });

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('patient_id', 'first_name last_name')
      .populate('doctor_id', 'first_name last_name specialization');

    res.status(201).json(populatedAppointment);
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update appointment
router.put('/:id', async (req, res) => {
  try {
    const updates = req.body;
    updates.updated_at = Date.now();

    // Prevent ID changes
    delete updates._id;
    delete updates.appointment_id;
    delete updates.patient_id;
    delete updates.doctor_id;

    const appointment = await Appointment.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('patient_id', 'first_name last_name')
      .populate('doctor_id', 'first_name last_name specialization');

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete appointment (admin only, or customer can cancel their own)
/**
 * Note: Deleting wipes the record. Usually canceling just updates status.
 * But we follow existing delete logic.
 */
router.delete('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if customer is trying to cancel their own appointment
    if (req.user.role === 'customer') {
      const user = await User.findById(req.user.id);
      if (!user || user.patient_id.toString() !== appointment.patient_id.toString()) {
        return res.status(403).json({ error: 'You can only cancel your own appointments' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await Appointment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
