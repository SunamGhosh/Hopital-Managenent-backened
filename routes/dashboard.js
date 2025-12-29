const express = require('express');
const { query, get } = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

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
      const totalPatients = await get('SELECT COUNT(*) as count FROM patients');
      const totalDoctors = await get('SELECT COUNT(*) as count FROM doctors WHERE status = ?', ['active']);
      const today = new Date().toISOString().split('T')[0];
      const appointmentsToday = await get(
        'SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ? AND status != ?',
        [today, 'cancelled']
      );
      const pendingAppointments = await get(
        'SELECT COUNT(*) as count FROM appointments WHERE status = ?',
        ['scheduled']
      );
      const recentAppointments = await query(
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
        WHERE a.appointment_date >= date('now')
        ORDER BY a.appointment_date ASC, a.appointment_time ASC
        LIMIT 10`
      );
      const appointmentsByStatus = await query(
        'SELECT status, COUNT(*) as count FROM appointments GROUP BY status'
      );
      const patientsByGender = await query(
        'SELECT gender, COUNT(*) as count FROM patients GROUP BY gender'
      );

      stats = {
        totalPatients: totalPatients.count,
        totalDoctors: totalDoctors.count,
        appointmentsToday: appointmentsToday.count,
        pendingAppointments: pendingAppointments.count,
        recentAppointments,
        appointmentsByStatus,
        patientsByGender
      };
    } else if (userRole === 'doctor') {
      // Doctor sees their own statistics
      const user = await get('SELECT doctor_id FROM users WHERE id = ?', [req.user.id]);
      if (!user || !user.doctor_id) {
        return res.json({ error: 'Doctor profile not found' });
      }

      const today = new Date().toISOString().split('T')[0];
      const appointmentsToday = await get(
        'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status != ?',
        [user.doctor_id, today, 'cancelled']
      );
      const pendingAppointments = await get(
        'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND status = ?',
        [user.doctor_id, 'scheduled']
      );
      const recentAppointments = await query(
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
        WHERE a.doctor_id = ? AND a.appointment_date >= date('now')
        ORDER BY a.appointment_date ASC, a.appointment_time ASC
        LIMIT 10`,
        [user.doctor_id]
      );

      stats = {
        appointmentsToday: appointmentsToday.count,
        pendingAppointments: pendingAppointments.count,
        recentAppointments
      };
    } else if (userRole === 'customer') {
      // Customer sees their own statistics
      const user = await get('SELECT patient_id FROM users WHERE id = ?', [req.user.id]);
      if (!user || !user.patient_id) {
        return res.json({ error: 'Patient profile not found' });
      }

      const today = new Date().toISOString().split('T')[0];
      const appointmentsToday = await get(
        'SELECT COUNT(*) as count FROM appointments WHERE patient_id = ? AND appointment_date = ? AND status != ?',
        [user.patient_id, today, 'cancelled']
      );
      const upcomingAppointments = await get(
        'SELECT COUNT(*) as count FROM appointments WHERE patient_id = ? AND appointment_date >= date("now") AND status = ?',
        [user.patient_id, 'scheduled']
      );
      const recentAppointments = await query(
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
        WHERE a.patient_id = ? AND a.appointment_date >= date('now')
        ORDER BY a.appointment_date ASC, a.appointment_time ASC
        LIMIT 10`,
        [user.patient_id]
      );

      stats = {
        appointmentsToday: appointmentsToday.count,
        upcomingAppointments: upcomingAppointments.count,
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

