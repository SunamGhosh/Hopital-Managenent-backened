const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
    record_id: { // The 'REC...' string ID
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
    appointment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment'
    },
    diagnosis: String,
    symptoms: String,
    prescription: String,
    test_results: String,
    notes: String,
    visit_date: {
        type: String, // YYYY-MM-DD
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

medicalRecordSchema.pre('save', function () {
    this.updated_at = Date.now();
});

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
