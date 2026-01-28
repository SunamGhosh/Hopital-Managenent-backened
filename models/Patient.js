const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    patient_id: { // The 'PAT...' string ID
        type: String,
        required: true,
        unique: true
    },
    first_name: {
        type: String,
        required: true
    },
    last_name: {
        type: String,
        required: true
    },
    date_of_birth: {
        type: Date,
        required: true
    },
    gender: {
        type: String,
        required: true
    },
    phone: String,
    email: String,
    address: String,
    emergency_contact_name: String,
    emergency_contact_phone: String,
    blood_group: String,
    allergies: String,
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

patientSchema.pre('save', function () {
    this.updated_at = Date.now();
});

module.exports = mongoose.model('Patient', patientSchema);
