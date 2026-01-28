const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const User = require('../models/User');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get dashboard statistics (role-specific)
router.get('/stats', async (req, res) => {
  try {
    const userRole = req.user.role;
    let stats = {};

    if (userRole === 'admin') {
      // Admin sees all statistics
      const totalPatients = await Patient.countDocuments();
      const totalDoctors = await Doctor.countDocuments({ status: 'active' });

      const today = new Date().toISOString().split('T')[0];

      const appointmentsToday = await Appointment.countDocuments({
        appointment_date: today,
        status: { $ne: 'cancelled' }
      });

      const pendingAppointments = await Appointment.countDocuments({
        status: 'scheduled'
      });

      const recentAppointments = await Appointment.find({
        appointment_date: { $gte: today }
      })
        .sort({ appointment_date: 1, appointment_time: 1 })
        .limit(10)
        .populate('patient_id', 'first_name last_name')
        .populate('doctor_id', 'first_name last_name specialization');

      const appointmentsByStatus = await Appointment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { status: '$_id', count: 1, _id: 0 } }
      ]);

      const patientsByGender = await Patient.aggregate([
        { $group: { _id: '$gender', count: { $sum: 1 } } },
        { $project: { gender: '$_id', count: 1, _id: 0 } }
      ]);

      stats = {
        totalPatients,
        totalDoctors,
        appointmentsToday,
        pendingAppointments,
        recentAppointments,
        appointmentsByStatus,
        patientsByGender
      };
    } else if (userRole === 'doctor') {
      // Doctor sees their own statistics
      const user = await User.findById(req.user.id);
      if (!user || !user.doctor_id) {
        return res.json({ error: 'Doctor profile not found' });
      }

      const today = new Date().toISOString().split('T')[0];

      const appointmentsToday = await Appointment.countDocuments({
        doctor_id: user.doctor_id,
        appointment_date: today,
        status: { $ne: 'cancelled' }
      });

      const pendingAppointments = await Appointment.countDocuments({
        doctor_id: user.doctor_id,
        status: 'scheduled'
      });

      const recentAppointments = await Appointment.find({
        doctor_id: user.doctor_id,
        appointment_date: { $gte: today }
      })
        .sort({ appointment_date: 1, appointment_time: 1 })
        .limit(10)
        .populate('patient_id', 'first_name last_name')
        .populate('doctor_id', 'first_name last_name specialization');

      stats = {
        appointmentsToday,
        pendingAppointments,
        recentAppointments
      };
    } else if (userRole === 'customer') {
      // Customer sees their own statistics
      const user = await User.findById(req.user.id);
      if (!user || !user.patient_id) {
        return res.json({ error: 'Patient profile not found' });
      }

      const today = new Date().toISOString().split('T')[0];

      const appointmentsToday = await Appointment.countDocuments({
        patient_id: user.patient_id,
        appointment_date: today,
        status: { $ne: 'cancelled' }
      });

      const upcomingAppointments = await Appointment.countDocuments({
        patient_id: user.patient_id,
        appointment_date: { $gte: today },
        status: 'scheduled'
      });

      const recentAppointments = await Appointment.find({
        patient_id: user.patient_id,
        appointment_date: { $gte: today }
      })
        .sort({ appointment_date: 1, appointment_time: 1 })
        .limit(10)
        .populate('patient_id', 'first_name last_name')
        .populate('doctor_id', 'first_name last_name specialization');

      stats = {
        appointmentsToday,
        upcomingAppointments,
        recentAppointments
      };
    }

    res.json(stats);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
