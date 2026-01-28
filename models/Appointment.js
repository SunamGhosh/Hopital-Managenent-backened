const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    appointment_id: { // The 'APT...' string ID
        type: String,
        required: true,
        unique: true
    },
    patient_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    doctor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true
    },
    appointment_date: {
        type: String, // Storing as string YYYY-MM-DD to match SQL DATE behavior, or Date
        required: true
    },
    appointment_time: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: 'scheduled'
    },
    reason: String,
    notes: String,
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

appointmentSchema.pre('save', function () {
    this.updated_at = Date.now();
});

module.exports = mongoose.model('Appointment', appointmentSchema);
