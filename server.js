'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');

const app = express();
const server = http.createServer(app);

// CORS Setup
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.options('*', cors());

app.use(bodyParser.json());

// Routes
app.use('/api/auth', authRoutes);

// Socket.io Setup
const io = socketIo(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});


const ccpPath = path.resolve(__dirname, '..', 'finalyear', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
const walletPath = path.join(process.cwd(), 'wallet');

async function getGateway() {
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const identity = await wallet.get('appUser');

    if (!identity) {
        throw new Error('Identity for user "appUser" not found. Register the user before retrying.');
    }

    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: 'appUser', discovery: { enabled: true, asLocalhost: true } });
    return gateway;
}

app.post('/api/initLedger', async (req, res) => {
    try {
        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        await contract.submitTransaction('InitLedger');
        res.send('Ledger initialized successfully');

        await gateway.disconnect();
    } catch (error) {
        console.error('Error initializing ledger: ${error}');
        res.status(500).send('Error: ${error.message}');
    }
});

app.post('/api/placeOrder', async (req, res) => {
    try {
        const { side, price, quantity, userId, producerId } = req.body;
        if (!side || !price || !quantity || !userId) {
            return res.status(400).send('Missing required parameters');
        }

        // Validate producerId for sell orders
        if (side === 'sell' && !producerId) {
            return res.status(400).send('Producer ID is required for sell orders');
        }

        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        await contract.submitTransaction('PlaceOrder', side, price.toString(), quantity.toString(), userId, producerId || '');
        res.send('Order placed successfully');
        await gateway.disconnect();
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

app.post('/api/matchOrders', async (req, res) => {
    try {
        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        // Call the MatchOrders function in the chaincode
        await contract.submitTransaction('MatchOrders');
        res.send('Orders matched successfully');

        await gateway.disconnect();
    } catch (error) {
        console.error('Error matching orders: ${error}');
        res.status(500).send('Error: ${error.message}');
    }
});

app.get('/api/getBalance/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).send('User ID is required');
        }

        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        const result = await contract.evaluateTransaction('GetBalance', userId.toString());
        res.json(JSON.parse(result.toString()));

        await gateway.disconnect();
    } catch (error) {
        console.error('Error fetching balance: ${error}');
        res.status(500).send('Error: ${error.message}');
    }
});

app.get('/api/getOrderBook', async (req, res) => {
    try {
        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        const result = await contract.evaluateTransaction('GetOrderBook');
        res.json(JSON.parse(result.toString()));

        await gateway.disconnect();
    } catch (error) {
        console.error('Error fetching order book: ${error}');
        res.status(500).send('Error: ${error.message}');
    }
});

io.on('connection', (socket) => {
    console.log('Client connected');

    // Function to fetch and emit order book
    async function broadcastOrderBook() {
        try {
            const gateway = await getGateway();
            const network = await gateway.getNetwork('testchannel');
            const contract = network.getContract('property');
            const result = await contract.evaluateTransaction('GetOrderBook');
            const orderBook = JSON.parse(result.toString());

            // Emit the updated order book to all connected clients
            io.emit('orderBookUpdate', orderBook);
            await gateway.disconnect();
        } catch (error) {
            console.error('Error fetching order book:', error);
            socket.emit('error', { message: 'Failed to fetch order book' });
        }
    }

    // Initial order book fetch
    broadcastOrderBook();

    // Periodic order book updates (e.g., every 5 seconds)
    const updateInterval = setInterval(broadcastOrderBook, 5000);

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected');
        clearInterval(updateInterval);
    });
});

app.post('/api/clearLedger', async (req, res) => {
    try {
        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        await contract.submitTransaction('ClearLedger');
        res.send('Ledger cleared successfully');

        await gateway.disconnect();
    } catch (error) {
        console.error('Error clearing ledger: ${error}');
        res.status(500).send('Error: ${error.message}');
    }
});

app.get('/api/getTradeHistory', async (req, res) => {
    try {
        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        const result = await contract.evaluateTransaction('GetTradeHistory');
        const trades = JSON.parse(result.toString());

        // Format the response to be more user-friendly
        const formattedTrades = trades.map(trade => ({
            buyerId: trade.buyerId,
            sellerId: trade.sellerId,
            price: parseFloat(trade.price),
            quantity: parseFloat(trade.quantity),
            totalValue: parseFloat(trade.price) * parseFloat(trade.quantity),
            timestamp: new Date(trade.timestamp).toLocaleString(),
        }));

        res.json(formattedTrades);
        await gateway.disconnect();
    } catch (error) {
        console.error('Error fetching trade history: ${error}');
        res.status(500).send('Error: ${error.message}');
    }
});

app.get('/api/getCurrentPrice', async (req, res) => {
    try {
        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        const result = await contract.evaluateTransaction('GetTradeHistory');
        const trades = JSON.parse(result.toString());

        if (trades.length === 0) {
            res.json({ currentPrice: null, message: "No trades available" });
            return;
        }

        // Sort trades by timestamp in descending order
        trades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Get most recent trade price
        const currentPrice = parseFloat(trades[0].price);

        // Calculate 24h price change
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const oldTrade = trades.find(trade => new Date(trade.timestamp) < oneDayAgo);
        const priceChange = oldTrade ? ((currentPrice - parseFloat(oldTrade.price)) / parseFloat(oldTrade.price) * 100) : 0;

        res.json({
            currentPrice,
            priceChange: parseFloat(priceChange.toFixed(2)),
            lastTradeTime: trades[0].timestamp
        });

        await gateway.disconnect();
    } catch (error) {
        console.error('Error fetching current price: ${error}');
        res.status(500).send('Error: ${error.message}');
    }
});

// Initialize market
app.post('/api/initMarket', async (req, res) => {
    try {
        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        await contract.submitTransaction('InitMarket');
        res.send('Market initialized successfully');

        await gateway.disconnect();
    } catch (error) {
        console.error('Error initializing market:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

// Update market
app.post('/api/updateMarket', async (req, res) => {
    try {
        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        await contract.submitTransaction('UpdateMarket');
        res.send('Market updated successfully');

        await gateway.disconnect();
    } catch (error) {
        console.error('Error updating market:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

// Run market until convergence
app.post('/api/runMarketUntilConvergence', async (req, res) => {
    try {
        const { maxIterations } = req.body;
        if (!maxIterations) {
            return res.status(400).send('Max iterations is required');
        }

        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        await contract.submitTransaction('RunMarketUntilConvergence', maxIterations);
        res.send('Market run completed successfully');

        await gateway.disconnect();
    } catch (error) {
        console.error('Error running market:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

// Get market state
app.get('/api/getMarketState', async (req, res) => {
    try {
        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        const result = await contract.evaluateTransaction('GetMarketState');
        res.json(JSON.parse(result.toString()));

        await gateway.disconnect();
    } catch (error) {
        console.error('Error fetching market state:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

// Get market statistics
app.get('/api/getMarketStatistics', async (req, res) => {
    try {
        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        const result = await contract.evaluateTransaction('GetMarketStatistics');
        res.json(JSON.parse(result.toString()));

        await gateway.disconnect();
    } catch (error) {
        console.error('Error fetching market statistics:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

// Get user balance
app.get('/api/getUserBalance/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).send('User ID is required');
        }

        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        const result = await contract.evaluateTransaction('GetUserBalance', userId);
        res.json({ balance: parseFloat(result.toString()) });

        await gateway.disconnect();
    } catch (error) {
        console.error('Error fetching user balance:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

// Get user trades
app.get('/api/getUserTrades/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).send('User ID is required');
        }

        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        const result = await contract.evaluateTransaction('GetUserTrades', userId);
        res.json(JSON.parse(result.toString()));

        await gateway.disconnect();
    } catch (error) {
        console.error('Error fetching user trades:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

// Get producer details
app.get('/api/getProducerDetails/:producerId', async (req, res) => {
    try {
        const { producerId } = req.params;
        if (!producerId) {
            return res.status(400).send('Producer ID is required');
        }

        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        const result = await contract.evaluateTransaction('GetProducerDetails', producerId);
        res.json(JSON.parse(result.toString()));

        await gateway.disconnect();
    } catch (error) {
        console.error('Error fetching producer details:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

// Transfer producer ownership
app.post('/api/transferProducerOwnership', async (req, res) => {
    try {
        const { producerId, currentOwnerId, newOwnerId } = req.body;
        if (!producerId || !currentOwnerId || !newOwnerId) {
            return res.status(400).send('Missing required parameters');
        }

        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        await contract.submitTransaction('TransferProducerOwnership', producerId, currentOwnerId, newOwnerId);
        res.send('Producer ownership transferred successfully');

        await gateway.disconnect();
    } catch (error) {
        console.error('Error transferring producer ownership:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

// Create new consumer
app.post('/api/createConsumer', async (req, res) => {
    try {
        const { id, beta, theta, demandMin, demandMax, initialBalance } = req.body;
        if (!id || !beta || !theta || !demandMin || !demandMax || !initialBalance) {
            return res.status(400).send('Missing required parameters');
        }

        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        await contract.submitTransaction(
            'CreateConsumer',
            id,
            beta.toString(),
            theta.toString(),
            demandMin.toString(),
            demandMax.toString(),
            initialBalance.toString()
        );
        res.send('Consumer created successfully');

        await gateway.disconnect();
    } catch (error) {
        console.error('Error creating consumer:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

// Create new producer
app.post('/api/createProducer', async (req, res) => {
    try {
        const { id, a, b, productionMin, productionMax, ownerId } = req.body;
        if (!id || !a || !b || !productionMin || !productionMax || !ownerId) {
            return res.status(400).send('Missing required parameters');
        }

        const gateway = await getGateway();
        const network = await gateway.getNetwork('testchannel');
        const contract = network.getContract('property');

        await contract.submitTransaction(
            'CreateProducer',
            id,
            a.toString(),
            b.toString(),
            productionMin.toString(),
            productionMax.toString(),
            ownerId
        );
        res.send('Producer created successfully');

        await gateway.disconnect();
    } catch (error) {
        console.error('Error creating producer:', error);
        res.status(500).send('Error: ' + error.message);
    }
});

mongoose.connect('mongodb+srv://adchamp123:O60iM4iqYwGU54xD@clusterfyp.gghea.mongodb.net/?retryWrites=true&w=majority&appName=Clusterfyp').then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));
const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});