require('dotenv').config();



const express = require("express");
const cloudinary = require('cloudinary').v2;
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const bodyParser = require("body-parser");
const cors = require("cors");

const { Pool } = require("pg");
const path = require("path");

cloudinary.config({
   
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});


// Create an Express app
const app = express();


// Middleware

app.use(cors({
    origin: "*",
}));

app.use(bodyParser.json());



// PostgreSQL setup (Neon)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});



const profilePicStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "usersProfilePic", // Folder in Cloudinary
        format: async (req, file) => "png", // Optional: Force file format
        public_id: (req, file) => `${Date.now()}-${file.originalname}` // Unique filename
    }
});

const profilePicUpload = multer({ storage: profilePicStorage });






const driverReceiptStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "driver_receipts", // Specify the folder in Cloudinary
        allowed_formats: ["pdf", "png", "jpg"], // Allow PDF and image formats
        public_id: (req, file) => `${Date.now()}-${file.originalname}`, // Unique filename
    },
});

const driverReceiptUpload = multer({ storage: driverReceiptStorage });





app.post('/api/uploadDriverReceipt', driverReceiptUpload.single('receipt'), async (req, res) => {
    const { orderId, pickupLocation, dropLocation, driverId, accountType } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    const receiptPath = req.file.path; // This will contain the full Cloudinary URL

    try {
        const result = await pool.query(
            `INSERT INTO receipts (order_id, receipt_path, pickup_location, drop_location, user_id, account_type)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [orderId, receiptPath, pickupLocation, dropLocation, driverId, accountType]
        );

        res.status(201).json({ message: "Receipt uploaded successfully", receipt: result.rows[0] });
    } catch (error) {
        console.error('Error uploading receipt:', error);
        res.status(500).json({ message: "Server error" });
    }
});





const userReceiptStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "user_receipts", // Folder in Cloudinary
        format: async (req, file) => "pdf", // Optional: Force file format
        public_id: (req, file) => `${Date.now()}-${file.originalname}` // Unique filename
    }
});

const userReceiptUpload = multer({ storage: userReceiptStorage });




app.post('/api/uploadUserReceipt', userReceiptUpload.single('receipt'), async (req, res) => {
    const { orderId, pickupLocation, dropLocation, driverId, accountType } = req.body;

    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
    }

    const receiptPath = req.file.path; // Use Cloudinary URL

    try {
        const result = await pool.query(
            `INSERT INTO receipts (order_id, receipt_path, pickup_location, drop_location, user_id, account_type)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [orderId, receiptPath, pickupLocation, dropLocation, driverId, accountType]
        );

        res.status(201).json({ message: "Receipt uploaded successfully", receipt: result.rows[0] });
    } catch (error) {
        console.error('Error uploading receipt:', error);
        res.status(500).json({ message: "Server error" });
    }
});






app.post("/api/add-user", profilePicUpload.single("profilePic"), async (req, res) => {
    try {
        const { firstName, lastName, email, phone, accountType, gender, country, language, password } = req.body;
        const profilePic = req.file ? req.file.path : null; // Use Cloudinary URL

        const query = `
            INSERT INTO users (first_name, last_name, email, phone, account_type, gender, profile_pic, country, language, password)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;
        `;
        const values = [firstName, lastName, email, phone, accountType, gender, profilePic, country, language, password];

        const result = await pool.query(query, values);

        res.status(201).json({
            message: "User added successfully",
            user: result.rows[0],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error saving user data" });
    }
});


// Login route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User  email not found' });
        }

        // Check if the password matches
        if (user.password !== password) {
            return res.status(401).json({ message: 'Password is incorrect' });
        }

        // Include user_id in the response
        res.json({ account_type: user.account_type, user_id: user.user_id, message: 'Login successful' }); // Assuming user.id is the user_id
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// API endpoint to get users
app.get("/api/users", async (req, res) => {
    try {
        const result = await pool.query("SELECT user_id, first_name,last_name, account_type, email, profile_pic,gender,country,language FROM users");
        res.json(result.rows); // Send the users as a response
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});


// Endpoint to save order data
app.post('/api/create-orders', async (req, res) => {
    const {
        loadId,
        trailerType,
        description,
        vehicleAmount,
        vehicleType,
        vehicleNotes,
        pickupContactName,
        pickupContactEmail,
        pickupContactPhone,
        pickupContactPhoneNotes,
        pickupContactAddress,
        pickupContactZip,
        pickupContactPickupRestrictions,
        deliveryContactName,
        deliveryContactEmail,
        deliveryContactPhone,
        deliveryContactPhoneNotes,
        deliveryAddress,
        deliveryContactZip,
        deliveryRestrictions,
        payment,
        paymentType,
        paymentNotes,
        userId, // Add userId to the destructured request body
    } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO orders (
                load_id,
                trailer_type,
                description,
                vehicle_amount,  -- Ensure this matches your table definition
                vehicle_type,     -- Ensure this matches your table definition
                vehicle_notes,    -- Ensure this matches your table definition
                pickup_contact_name,
                pickup_contact_email,
                pickup_contact_phone,
                pickup_contact_phone_notes,
                pickup_contact_address,
                pickup_contact_zip,
                pickup_contact_pickup_restrictions,
                delivery_contact_name,
                delivery_contact_email,
                delivery_contact_phone,
                delivery_contact_phone_notes,
                delivery_address,
                delivery_contact_zip,
                delivery_restrictions,
                payment,
                payment_type,
                payment_notes,
                user_id  -- Include user_id in the INSERT statement
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
            ) RETURNING id`,
            [
                loadId,
                trailerType,
                description,
                vehicleAmount,
                vehicleType,
                vehicleNotes,
                pickupContactName,
                pickupContactEmail,
                pickupContactPhone,
                pickupContactPhoneNotes,
                pickupContactAddress,
                pickupContactZip,
                pickupContactPickupRestrictions,
                deliveryContactName,
                deliveryContactEmail,
                deliveryContactPhone,
                deliveryContactPhoneNotes,
                deliveryAddress,
                deliveryContactZip,
                deliveryRestrictions,
                payment,
                paymentType,
                paymentNotes,
                userId, // Add userId to the array of values
            ]
        );

        res.status(201).json({ message: 'Order created successfully', orderId: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error saving order' });
    }
});

// Endpoint to fetch loads data with status NULL
app.get("/api/get-loads", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM orders WHERE status IS NULL");
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching loads:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint to fetch idle driver from users
app.get('/api/get-drivers', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT user_id, last_name FROM users WHERE account_type = 'Driver' AND status = 'idle'"
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching drivers:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



// Assign a driver
app.post('/api/assign-driver', async (req, res) => {
    const { tripName, pickupLocation, deliveryLocation, payment, userId } = req.body;

    try {
        // Insert the assigned order into the database
        const result = await pool.query(
            'INSERT INTO assigned_orders (trip_name, pickup_location, delivery_location, payment, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [tripName, pickupLocation, deliveryLocation, payment, userId]
        );

        // Update the driver's status to 'assigned'
        await pool.query('UPDATE users SET status = $1 WHERE user_id = $2', ['assigned', userId]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error assigning driver:', error);
        res.status(500).json({ message: 'Error assigning driver' });
    }
});

// Endpoint to update order status
app.patch('/api/update-order-status/:orderId', async (req, res) => {
    const { orderId } = req.params;

    try {
        await pool.query('UPDATE orders SET status = $1 WHERE load_id = $2', ['assigned', orderId]);
        res.status(200).json({ message: 'Order status updated to assigned' });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Error updating order status' });
    }
});

// Endpoint to fetch assigned orders
app.get('/api/assigned_orders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM assigned_orders');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching assigned orders:', error);
        res.status(500).send('Server error');
    }
});

// Endpoint to fetch users orders
app.get('/api/myOrders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching my orders:', error);
        res.status(500).send('Server error');
    }
});

// Endpoint to fetch the order assigned to the loged in driver (driver check its assigned tasks )
app.get('/api/driverOrders', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching my orders:', error);
        res.status(500).send('Server error');
    }
});

// when driver update the status of the order
app.put('/api/updateOrderStatus', async (req, res) => {
    const { id, status } = req.body;

    if (!id || !status) {
        return res.status(400).json({ message: 'Invalid request: Missing id or status' });
    }

    try {
        const result = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({ message: 'Status updated successfully', updatedOrder: result.rows[0] });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Server error' });
    }
});



app.get('/api/allReceipts', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM receipts');
        const receipts = result.rows.map((receipt) => {
            const isPDF = receipt.receipt_path.endsWith('.pdf');
            return {
                ...receipt,
                receipt_path: receipt.receipt_path.startsWith('http')
                    ? receipt.receipt_path // Use as-is if full URL
                    : `https://res.cloudinary.com/du6astrxs/driver_receipts/${isPDF ? 'raw' : 'image'}/upload/${receipt.receipt_path}`,
            };
        });
        res.json(receipts);
    } catch (error) {
        console.error('Error fetching receipts:', error);
        res.status(500).json({ message: 'Server error' });
    }
});




// Get chat messages
app.get('/api/chat', async (req, res) => {
    const { user1, user2 } = req.query;

    try {
        const messages = await pool.query(`
            SELECT 
                m.id, 
                m.sender_id, 
                m.receiver_id, 
                m.content, 
                m.timestamp, 
                u.first_name AS sender_first_name, 
                u.last_name AS sender_last_name
            FROM messages m
            INNER JOIN users u ON m.sender_id = u.user_id
            WHERE 
                (m.sender_id = $1 AND m.receiver_id = $2) 
                OR (m.sender_id = $2 AND m.receiver_id = $1)
            ORDER BY m.timestamp ASC
        `, [user1, user2]);

        res.json(messages.rows);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).send('Error fetching messages');
    }
});
;

// Send a message
app.post("/api/chat", async (req, res) => {
    const { senderId, receiverId, content } = req.body;

    const result = await pool.query(
        "INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *",
        [senderId, receiverId, content]
    );

    res.json(result.rows[0]);
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
