const mongoose = require('mongoose');

const connectDB = async () => {
    const maxRetries = 5;
    let retryCount = 0;

    const connectWithRetry = async () => {
        try {
            const conn = await mongoose.connect(process.env.MONGO_URI, {
                // Connection options for better stability
                maxPoolSize: 10,
                minPoolSize: 2,
                maxIdleTimeMS: 30000,
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                // Remove deprecated options
                // bufferMaxEntries: 0,
                // bufferCommands: false,
                // Retry writes for better reliability
                retryWrites: true,
                w: 'majority'
            });

            console.log('MongoDB Connection String:', process.env.MONGO_URI.replace(/:[^:]*@/, ':****@'));
            console.log(`MongoDB Connected: ${conn.connection.host}`);
            
            // Debug database connection
            const db = mongoose.connection.db;
            console.log('Current database:', db.databaseName);
            
            // List all collections
            const collections = await db.listCollections().toArray();
            console.log('\nAvailable collections:');
            for (const collection of collections) {
                const count = await db.collection(collection.name).countDocuments();
                console.log(`- ${collection.name}: ${count} documents`);
            }

            // Set up connection event handlers
            mongoose.connection.on('error', (err) => {
                console.error('MongoDB connection error:', err);
            });

            mongoose.connection.on('disconnected', () => {
                console.log('MongoDB disconnected. Attempting to reconnect...');
                setTimeout(connectWithRetry, 5000);
            });

            mongoose.connection.on('reconnected', () => {
                console.log('MongoDB reconnected successfully');
            });

        } catch (error) {
            retryCount++;
            console.error(`MongoDB Connection Error (Attempt ${retryCount}/${maxRetries}):`, error.message);
            
            if (retryCount < maxRetries) {
                console.log(`Retrying connection in 5 seconds... (${retryCount}/${maxRetries})`);
                setTimeout(connectWithRetry, 5000);
            } else {
                console.error('Max retries reached. MongoDB connection failed.');
                console.error('Server will continue but database features will not work.');
                console.error('Please check:');
                console.error('1. MongoDB Atlas IP whitelist includes your current IP');
                console.error('2. MONGO_URI in .env file is correct');
                console.error('3. MongoDB cluster is running (not paused)');
                console.error('4. Network/firewall is not blocking the connection');
                // Don't exit - allow server to start for development
                // process.exit(1);
            }
        }
    };

    await connectWithRetry();
};

module.exports = connectDB;