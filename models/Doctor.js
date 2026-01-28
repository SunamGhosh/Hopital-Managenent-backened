const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    doctor_id: { // The 'DOC...' string ID
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
    specialization: {
        type: String,
        required: true
    },
    phone: String,
    email: String,
    qualification: String,
    experience_years: Number,
    consultation_fee: Number,
    available_days: String, // You might want to make this an array of strings in the future
    available_time_start: String,
    available_time_end: String,
    status: {
        type: String,
        default: 'active'
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

doctorSchema.pre('save', function () {
    this.updated_at = Date.now();
});

module.exports = mongoose.model('Doctor', doctorSchema);
