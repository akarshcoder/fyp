import React, { useContext, useState, useEffect } from "react";
import Orderbook from "./orderbook";
import TradeCharts from "./charts";
import { AuthContext } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import axios from 'axios';

const Home = () => {
    const { logout, user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [price, setPrice] = useState('');
    const [quantity, setQuantity] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [activeTab, setActiveTab] = useState('trade');
    const [tradeHistory, setTradeHistory] = useState([]);
    const [marketStats, setMarketStats] = useState(null);
    const [userBalance, setUserBalance] = useState(0);
    const [marketState, setMarketState] = useState(null);
    const [producerDetails, setProducerDetails] = useState(null);
    const [newConsumerForm, setNewConsumerForm] = useState({
        id: '',
        beta: '',
        theta: '',
        demandMin: '',
        demandMax: '',
        initialBalance: ''
    });
    const [newProducerForm, setNewProducerForm] = useState({
        id: '',
        a: '',
        b: '',
        productionMin: '',
        productionMax: '',
        ownerId: ''
    });
    const [transferForm, setTransferForm] = useState({
        producerId: '',
        currentOwnerId: '',
        newOwnerId: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Authorization': `Bearer ${token}` };

            // Fetch all required data in parallel
            const [tradeHistoryRes, marketStatsRes, userBalanceRes, marketStateRes] = await Promise.all([
                axios.get('http://localhost:8080/api/getTradeHistory', { headers }),
                axios.get('http://localhost:8080/api/getMarketStatistics', { headers }),
                axios.get(`http://localhost:8080/api/getUserBalance/${user.userId}`, { headers }),
                axios.get('http://localhost:8080/api/getMarketState', { headers })
            ]);

            setTradeHistory(tradeHistoryRes.data);
            setMarketStats(marketStatsRes.data);
            setUserBalance(userBalanceRes.data.balance);
            setMarketState(marketStateRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        }
    };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    const handleLogout = () => {
        logout();
        navigate("/auth");
    };

    const handleTrade = async (side) => {
        try {
            setError('');
            setSuccess('');

            if (!price || !quantity) {
                setError('Please enter both price and quantity');
                return;
            }

            const token = localStorage.getItem('token');
            await axios.post(
                'http://localhost:8080/api/placeOrder',
                {
                    side,
                    price: parseFloat(price),
                    quantity: parseFloat(quantity),
                    userId: user.userId,
                    producerId: side === 'sell' ? producerDetails?.id : undefined
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            setSuccess(`${side.toUpperCase()} order placed successfully!`);
            setPrice('');
            setQuantity('');
            fetchData();
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to place order');
        }
    };

    const handleCreateConsumer = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                'http://localhost:8080/api/createConsumer',
                newConsumerForm,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            setSuccess('Consumer created successfully!');
            setNewConsumerForm({
                id: '',
                beta: '',
                theta: '',
                demandMin: '',
                demandMax: '',
                initialBalance: ''
            });
            fetchData();
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to create consumer');
        }
    };

    const handleCreateProducer = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                'http://localhost:8080/api/createProducer',
                newProducerForm,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            setSuccess('Producer created successfully!');
            setNewProducerForm({
                id: '',
                a: '',
                b: '',
                productionMin: '',
                productionMax: '',
                ownerId: ''
            });
            fetchData();
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to create producer');
        }
    };

    const handleTransferOwnership = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                'http://localhost:8080/api/transferProducerOwnership',
                transferForm,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            setSuccess('Producer ownership transferred successfully!');
            setTransferForm({
                producerId: '',
                currentOwnerId: '',
                newOwnerId: ''
            });
            fetchData();
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to transfer ownership');
        }
    };

    const calculateOrderValue = () => {
        if (price && quantity) {
            return (parseFloat(price) * parseFloat(quantity)).toFixed(4);
        }
        return '0';
    };

    const MarketStatsPanel = () => (
        <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Market Statistics</h2>
            {marketStats && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-600">Current Price</p>
                        <p className="text-lg font-semibold">₹{marketStats.currentPrice?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-600">24h Change</p>
                        <p className={`text-lg font-semibold ${marketStats.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {marketStats.priceChange24h?.toFixed(2)}%
                        </p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-600">24h Volume</p>
                        <p className="text-lg font-semibold">₹{marketStats.volume24h?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-600">24h Trades</p>
                        <p className="text-lg font-semibold">{marketStats.tradeCount24h || 'N/A'}</p>
                    </div>
                </div>
            )}
        </div>
    );

    const TradePanel = () => (
        <>
            {error && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
                    {success}
                </div>
            )}
            
            <div className="mb-4 p-3 bg-blue-50 rounded">
                <p className="text-sm text-gray-600">Your Balance</p>
                <p className="text-lg font-semibold">₹{userBalance.toFixed(2)}</p>
            </div>

            <div className="flex space-x-4 mb-4">
                <button 
                    onClick={() => handleTrade('buy')}
                    className="flex-1 bg-green-500 text-white py-2 rounded-md font-bold focus:outline-none focus:ring-2 focus:ring-green-400 hover:bg-green-600"
                >
                    Buy
                </button>
                <button 
                    onClick={() => handleTrade('sell')}
                    className="flex-1 bg-red-500 text-white py-2 rounded-md font-bold focus:outline-none focus:ring-2 focus:ring-red-400 hover:bg-red-600"
                >
                    Sell
                </button>
            </div>
            
            <div className="space-y-4">
                <div className="flex justify-between text-gray-700">
                    <span>Price (₹)</span>
                    <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.0625"
                        className="border rounded-md px-4 py-2 w-28 text-right"
                        min="0"
                        step="0.0001"
                    />
                </div>
                <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Quantity"
                    className="w-full border rounded-md px-4 py-2"
                    min="0"
                    step="0.0001"
                />
                <div className="flex justify-between text-gray-700">
                    <span>Order Value</span>
                    <span>₹{calculateOrderValue()}</span>
                </div>
            </div>
        </>
    );

    const HistoryPanel = () => (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buyer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {tradeHistory.map((trade, index) => (
                        <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trade.buyerId}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trade.sellerId}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{trade.price.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{trade.quantity}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{trade.totalValue.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(trade.timestamp)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const ManagementPanel = () => (
        <div className="space-y-6">
            <div className="bg-white shadow-lg rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Create New Consumer</h2>
                <form onSubmit={handleCreateConsumer} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Consumer ID"
                        value={newConsumerForm.id}
                        onChange={(e) => setNewConsumerForm({...newConsumerForm, id: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <input
                        type="number"
                        placeholder="Beta"
                        value={newConsumerForm.beta}
                        onChange={(e) => setNewConsumerForm({...newConsumerForm, beta: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <input
                        type="number"
                        placeholder="Theta"
                        value={newConsumerForm.theta}
                        onChange={(e) => setNewConsumerForm({...newConsumerForm, theta: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <input
                        type="number"
                        placeholder="Min Demand"
                        value={newConsumerForm.demandMin}
                        onChange={(e) => setNewConsumerForm({...newConsumerForm, demandMin: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <input
                        type="number"
                        placeholder="Max Demand"
                        value={newConsumerForm.demandMax}
                        onChange={(e) => setNewConsumerForm({...newConsumerForm, demandMax: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <input
                        type="number"
                        placeholder="Initial Balance"
                        value={newConsumerForm.initialBalance}
                        onChange={(e) => setNewConsumerForm({...newConsumerForm, initialBalance: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <button
                        type="submit"
                        className="w-full bg-blue-500 text-white py-2 rounded-md font-bold hover:bg-blue-600"
                    >
                        Create Consumer
                    </button>
                </form>
            </div>

            <div className="bg-white shadow-lg rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Create New Producer</h2>
                <form onSubmit={handleCreateProducer} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Producer ID"
                        value={newProducerForm.id}
                        onChange={(e) => setNewProducerForm({...newProducerForm, id: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <input
                        type="number"
                        placeholder="Cost Coefficient A"
                        value={newProducerForm.a}
                        onChange={(e) => setNewProducerForm({...newProducerForm, a: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <input
                        type="number"
                        placeholder="Cost Coefficient B"
                        value={newProducerForm.b}
                        onChange={(e) => setNewProducerForm({...newProducerForm, b: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <input
                        type="number"
                        placeholder="Min Production"
                        value={newProducerForm.productionMin}
                        onChange={(e) => setNewProducerForm({...newProducerForm, productionMin: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <input
                        type="number"
                        placeholder="Max Production"
                        value={newProducerForm.productionMax}
                        onChange={(e) => setNewProducerForm({...newProducerForm, productionMax: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <input
                        type="text"
                        placeholder="Owner ID"
                        value={newProducerForm.ownerId}
                        onChange={(e) => setNewProducerForm({...newProducerForm, ownerId: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <button
                        type="submit"
                        className="w-full bg-blue-500 text-white py-2 rounded-md font-bold hover:bg-blue-600"
                    >
                        Create Producer
                    </button>
                </form>
            </div>

            <div className="bg-white shadow-lg rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Transfer Producer Ownership</h2>
                <form onSubmit={handleTransferOwnership} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Producer ID"
                        value={transferForm.producerId}
                        onChange={(e) => setTransferForm({...transferForm, producerId: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <input
                        type="text"
                        placeholder="Current Owner ID"
                        value={transferForm.currentOwnerId}
                        onChange={(e) => setTransferForm({...transferForm, currentOwnerId: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <input
                        type="text"
                        placeholder="New Owner ID"
                        value={transferForm.newOwnerId}
                        onChange={(e) => setTransferForm({...transferForm, newOwnerId: e.target.value})}
                        className="w-full border rounded-md px-4 py-2"
                    />
                    <button
                        type="submit"
                        className="w-full bg-blue-500 text-white py-2 rounded-md font-bold hover:bg-blue-600"
                    >
                        Transfer Ownership
                    </button>
                </form>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-100 text-black">
            <header className="bg-white shadow-md flex justify-between items-center px-6 py-4">
                <h1 className="text-xl font-bold text-gray-900">Energy Trading Platform</h1>
                <div className="space-x-4">
                    <button
                        onClick={handleLogout}
                        className="bg-red-500 text-white px-4 py-2 rounded-md"
                    >
                        Sign out
                    </button>
                </div>
            </header>
            
            <div className="px-6 py-8">
                <MarketStatsPanel />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white shadow-lg rounded-lg p-6">
                        <Orderbook />
                    </div>
                    
                    <div className="bg-white shadow-lg rounded-lg p-6">
                        <div className="flex border-b mb-4">
                            <button
                                className={`px-4 py-2 font-medium ${activeTab === 'trade' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                onClick={() => setActiveTab('trade')}
                            >
                                Trade
                            </button>
                            <button
                                className={`px-4 py-2 font-medium ${activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                onClick={() => setActiveTab('history')}
                            >
                                History
                            </button>
                            <button
                                className={`px-4 py-2 font-medium ${activeTab === 'management' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                onClick={() => setActiveTab('management')}
                            >
                                Management
                            </button>
                        </div>
                        {activeTab === 'trade' ? <TradePanel /> : 
                         activeTab === 'history' ? <HistoryPanel /> : 
                         <ManagementPanel />}
                    </div>
                </div>
            </div>
            <TradeCharts />
        </div>
    );
};

export default Home;