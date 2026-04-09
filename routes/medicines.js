const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorize } = require('../middleware/auth');
const Medicine = require('../models/Medicine');
const multer = require('multer');
const path = require('path');

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Error: File upload only supports the following filetypes - " + filetypes));
  }
});

const router = express.Router();

// Generate unique medicine ID
function generateMedicineId() {
  return 'MED' + Date.now().toString().slice(-8);
}

// Get all medicines (Public)
router.get('/', async (req, res) => {
  console.log('GET /api/medicines - Request received');
  try {
    const { search, category, status } = req.query;
    console.log('Query params:', { search, category, status });

    let query = {};

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { name: regex },
        { medicine_id: regex },
        { manufacturer: regex }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (status) {
      query.status = status;
    }

    const medicines = await Medicine.find(query).sort({ created_at: -1 });
    res.json(medicines);
  } catch (error) {
    console.error('Get medicines error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get categories (Public)
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Medicine.distinct('category');
    res.json(categories.sort());
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply authentication for protected routes below
router.use(authenticateToken);

// Get medicine by ID
router.get('/:id', async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }
    res.json(medicine);
  } catch (error) {
    console.error('Get medicine error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create medicine (admin or pharmacist only)
router.post('/', authorize('admin', 'pharmacist'), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, [
  body('name').notEmpty().withMessage('Medicine name is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('stock_quantity').isNumeric().withMessage('Stock quantity must be a number'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name, category, manufacturer, expiry_date, price, stock_quantity
    } = req.body;

    const medicineCode = generateMedicineId();
    
    // Get image path if uploaded
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    const medicine = await Medicine.create({
      medicine_id: medicineCode,
      name, 
      category, 
      manufacturer: manufacturer || null, 
      expiry_date: expiry_date ? new Date(expiry_date) : null, 
      price: parseFloat(price), 
      stock_quantity: parseInt(stock_quantity),
      image: imagePath
    });

    res.status(201).json(medicine);
  } catch (error) {
    console.error('Create medicine error:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

// Update medicine (admin or pharmacist only)
// Update medicine (admin or pharmacist only)
router.put('/:id', authorize('admin', 'pharmacist'), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const updates = { ...req.body };
    updates.updated_at = Date.now();
    delete updates._id;
    delete updates.medicine_id;

    if (updates.expiry_date === '') updates.expiry_date = null;
    if (updates.price) updates.price = parseFloat(updates.price);
    if (updates.stock_quantity) updates.stock_quantity = parseInt(updates.stock_quantity);

    if (req.file) {
      updates.image = `/uploads/${req.file.filename}`;
    }

    const medicine = await Medicine.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    res.json(medicine);
  } catch (error) {
    console.error('Update medicine error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete medicine (admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const medicine = await Medicine.findByIdAndDelete(req.params.id);
    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }
    res.json({ message: 'Medicine deleted successfully' });
  } catch (error) {
    console.error('Delete medicine error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Medicine.distinct('category');
    res.json(categories.sort());
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
