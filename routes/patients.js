const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorize } = require('../middleware/auth');
const Patient = require('../models/Patient');
const User = require('../models/User');

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
    const skip = (page - 1) * limit;

    let query = {};

    // Customers can only see their own record
    if (req.user.role === 'customer') {
      const user = await User.findById(req.user.id);
      if (user && user.patient_id) {
        query._id = user.patient_id;
      } else {
        return res.json({ patients: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } });
      }
    }

    if (search && req.user.role !== 'customer') {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { first_name: regex },
        { last_name: regex },
        { patient_id: regex }, // The string ID PAT...
        { phone: regex }
      ];
    }

    const patients = await Patient.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Patient.countDocuments(query);

    res.json({
      patients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
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
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Authorization check for customer
    if (req.user.role === 'customer') {
      const user = await User.findById(req.user.id);
      if (!user.patient_id || user.patient_id.toString() !== req.params.id) {
        return res.status(403).json({ error: 'Unauthorized access' });
      }
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

    const patient = await Patient.create({
      patient_id: patientId, // Custom string ID
      first_name, last_name, date_of_birth, gender,
      phone, email, address, emergency_contact_name,
      emergency_contact_phone, blood_group, allergies
    });

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
      const user = await User.findById(req.user.id);
      if (!user || !user.patient_id || user.patient_id.toString() !== req.params.id) {
        return res.status(403).json({ error: 'You can only update your own record' });
      }
    }

    // Sanitize body or just pass it (assuming model validation handles schema)
    const updates = req.body;
    updates.updated_at = Date.now();

    // Prevent updating immutable fields if necessary (like _id or patient_id string)
    delete updates._id;
    delete updates.patient_id;

    const patient = await Patient.findByIdAndUpdate(req.params.id, updates, { new: true });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (error) {
    console.error('Update patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete patient (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    // Ideally update user link too, but optional for now
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Delete patient error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
