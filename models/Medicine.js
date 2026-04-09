const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    medicine_id: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    manufacturer: String,
    expiry_date: Date,
    price: {
        type: Number,
        required: true
    },
    image: {
        type: String, // Path to the image
        default: null
    },
    stock_quantity: {
        type: Number,
        required: true,
        default: 0
    },
    status: {
        type: String,
        enum: ['available', 'out of stock', 'expired'],
        default: 'available'
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

medicineSchema.pre('save', function (next) {
    this.updated_at = Date.now();
    if (this.stock_quantity <= 0) {
        this.status = 'out of stock';
    } else if (this.expiry_date && this.expiry_date < new Date()) {
        this.status = 'expired';
    } else {
        this.status = 'available';
    }
    next();
});

module.exports = mongoose.model('Medicine', medicineSchema);
